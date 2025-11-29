// src/hooks/useBbcodeGenerator.js
import { useState, useCallback } from 'react';
import { getUtcFormattedDateTime } from '../utils/dateTimeUtils';
import { getDepartmentFullName } from '../utils/bbcodeHelpers';
import generateDecedentBBCode from '../phmc-bbcode-generators/generateMassFatality';

const useBbcodeGenerator = (selectedForm, formValues, finalSelectOptions, agencyDataStore) => {
  const [generatedBBCode, setGeneratedBBCode] = useState("");
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [showBBCode, setShowBBCode] = useState(false);

  // Function to format date to MM/DD/YYYY
  const formatToNorthAmericanDate = (isoDateTime) => { /* ... */ };

  // Function to format date to MMM-DD-YYYY
  const formatToMMM_DD_YYYY = (isoDateTime) => {
    if (!isoDateTime) return 'NO_DATE';
    try {
        const date = new Date(isoDateTime);
        if (isNaN(date.getTime())) {
            const parts = isoDateTime.split('T')[0].split('-');
            if (parts.length === 3) {
                 const year = parseInt(parts[0], 10);
                 const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
                 const day = parseInt(parts[2], 10);
                 const reconsDate = new Date(year, month, day);
                 if (!isNaN(reconsDate.getTime())) {
                    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    return `${monthNames[reconsDate.getMonth()]}-${reconsDate.getDate().toString().padStart(2, '0')}-${reconsDate.getFullYear()}`;
                 }
            }
            return isoDateTime;
        }
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = monthNames[date.getMonth()];
        const day = date.getDate().toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${month}-${day}-${year}`;
    } catch (e) {
        console.error("Error formatting date for title (MMM-DD-YYYY):", e);
        return isoDateTime;
    }
  };

  const parseCaseNumber = (url) => {
    if (!url) return '';
    const match = url.match(/\d+$/);
    return match ? match[0] : '';
  };

  const generateBBCode = useCallback(() => {
    if (!selectedForm?.template) {
      setGeneratedBBCode("");
      setGeneratedTitle("");
      return;
    }

    console.log("--- BBCode Generation Triggered ---");
    console.log("Selected Form:", selectedForm.name);
    console.log("Form Values:", formValues);

    let bbcode = selectedForm.template;
    let title = "";

    // Evaluation context with fallbacks
    const ctx = { ...formValues }; // Start with formValues
    ctx.formData = ctx; // Keep formData alias

    // Add specialized functions/variables to ctx for expression evaluation
    ctx.generateDecedentBBCode = (decedentsArray) => generateDecedentBBCode(decedentsArray, finalSelectOptions); // Pass finalSelectOptions
    ctx.decedents_array_bbcode = ctx.generateDecedentBBCode(ctx.decedents);

    const addFallback = (src, target) => {
      if (formValues[src] !== undefined && ctx[target] === undefined) {
        ctx[target] = formValues[src];
      }
    };
    addFallback('patientName', 'PatientName'); addFallback('PatientName', 'patientName');
    addFallback('employeeName', 'EmployeeName'); addFallback('EmployeeName', 'employeeName');
    addFallback('phmcEmployee', 'PHMCEmployee'); addFallback('PHMCEmployee', 'phmcEmployee');
    addFallback('coronerEmployee', 'CoronerEmployee'); addFallback('CoronerEmployee', 'coronerEmployee');

    // ──────────────────────────────────────────────────────────────
    // 1. SPECIAL CORONER EMAIL TITLE
    // ──────────────────────────────────────────────────────────────
    if (selectedForm.name === "Coroner Email" || selectedForm.id === "coroner_email") {
      // ... Coroner Email title logic ...
        } else if (selectedForm.firebaseKey === 'mass-ftality-test') { // Handle Mass Fatality Report title
            // --- DEBUGGING LOG ---
            console.log('[DEBUG Mass Fatality Title] formValues.decedents:', formValues.decedents);
            console.log('[DEBUG Mass Fatality Title] formValues.dateTime:', formValues.dateTime);
            // --- END DEBUGGING LOG ---

            const decedentCounts = {};
            if (Array.isArray(formValues.decedents)) {
                formValues.decedents.forEach(d => {
                    const name = d.decedentName?.trim();
                    if (name) {
                        decedentCounts[name] = (decedentCounts[name] || 0) + 1;
                    }
                });
            }

            const formattedDecedents = Object.entries(decedentCounts)
                .map(([name, count]) => (count > 1 ? `${name} (x${count})` : name))
                .join(' ');
            
            const formattedDate = formatToNorthAmericanDate(formValues.dateTime);
            
            if (formattedDecedents) {
                title = `[Mass Fatality Report] ${formattedDecedents} - ${formattedDate}`;
            } else {
                title = `[Mass Fatality Report] No Decedents - ${formattedDate}`;
            }
            setGeneratedTitle(title);
        } else if (selectedForm.firebaseKey === 'death_record') { // Handle Death Record title
            const currentYear = new Date().getFullYear();
            const caseNumber = parseCaseNumber(formValues.deathReportPostId) || formValues.caseNumber || 'UNKNOWN';
            const decedentName = formValues.decedentName || 'UNKNOWN';
            const decedentOOC = formValues.decedentOOC || 'N/A';
            const formattedDateOfDeath = formatToMMM_DD_YYYY(formValues.dateOfDeath);

            title = `[CASE-#${currentYear}-${caseNumber}] ${decedentName} ((${decedentOOC} | ${formattedDateOfDeath}))`;
            setGeneratedTitle(title);
        }
    // ──────────────────────────────────────────────────────────────
    // 2. TITLE GENERATION (Smart + DMEC aware)
    // ──────────────────────────────────────────────────────────────
    else if (selectedForm.titleGeneratorCode) {
  try {
    let rawTitle = selectedForm.titleGeneratorCode.trim();
            const cleanDate = formatToNorthAmericanDate(formValues.dateTime);
    const typeOfDeathValue = formValues.typeOfDeath || formValues.mannerOfDeath || "Type of Death Not Specified";
    const titleDecedentName = formValues.decedentName  || "Fill in the Decedent IC field!";
    const decedentOOCValue = formValues.decedentOOC || formValues.patientOOC || "Fill in the Decedent OOC field!";

    // NOW use the correct variable
    title = rawTitle
      .replace(/{{typeOfDeath}}/g, typeOfDeathValue)
      .replace(/{{decedentName}}/g, titleDecedentName)
      .replace(/{{decedentOOC}}/g, decedentOOCValue)
      .replace(/{{date}}/g, cleanDate);

    console.log('[DEBUG TitleGen] Final generatedTitle:', title);
    setGeneratedTitle(title);
  } catch (e) {
    console.error("Title generation failed:", e);
    setGeneratedTitle("Title Error");
  }
}
    // ──────────────────────────────────────────────────────────────
    // 3. CBC CHECKBOXES — RUN FIRST AND SAFE
    // ──────────────────────────────────────────────────────────────
    bbcode = bbcode.replace(/\[cb:([^\]]+)\]([^\[\]]*)/g, (match, fieldName, text) => {
      const field = fieldName.trim();
      const option = text.trim();
      if (!field || !option) return match;

      const value = formValues[field];
      let comparisonValue = value;

      // If the value is an object and has a 'value' property, use that for comparison
      if (typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, 'value')) {
          comparisonValue = value.value;
      }

      if (Array.isArray(comparisonValue)) {
        const selected = comparisonValue.map(v => String(v).trim()).includes(option);
        return selected ? `[cbc] ${option}` : `[cb] ${option}`;
      }

      const selected = String(comparisonValue || '').trim() === option;
      return selected ? `[cbc] ${option}` : `[cb] ${option}`;
    });

    bbcode = bbcode.replace(/\[cb:([^\]]+)\]/gi, (match, fieldName) => {
      const field = fieldName.trim();
      const value = formValues[field];
      const hasValue = value && (!Array.isArray(value) || value.length > 0);
      return hasValue ? "[cbc]" : "[cb]";
    });

    // ──────────────────────────────────────────────────────────────
    // 4. CONDITIONAL BLOCKS
    // ──────────────────────────────────────────────────────────────
bbcode = bbcode.replace(/\[conditional\s+field=["']?([^"'\]\s]+)["']?\s+value=["']?([^"'\]]+)["']?\](.*?)\[\/conditional\]/gis, (match, field, expected, inner) => {
  const currentValue = formValues[field];

  // Handle checkbox booleans properly
  let actualValue = currentValue;
  if (typeof currentValue === 'string') {
    actualValue = currentValue.toLowerCase() === 'true' ? true : 
                   currentValue.toLowerCase() === 'false' ? false : 
                   currentValue;
  }

  const expectedNormalized = expected.toLowerCase() === 'true' ? true :
                             expected.toLowerCase() === 'false' ? false :
                             expected;

  const conditionMet = Array.isArray(actualValue)
    ? actualValue.map(v => String(v)).includes(String(expectedNormalized))
    : actualValue == expectedNormalized; // loose equality to handle string "true" vs boolean true

  console.log(`[Conditional] field=${field}, expected=${expectedNormalized}, actual=${actualValue}, met=${conditionMet}`);

  return conditionMet ? inner.trim() : '';
});
    // ──────────────────────────────────────────────────────────────
    // 5. FIELD REPLACEMENT — SAFE PER-FIELD
    // ──────────────────────────────────────────────────────────────
    selectedForm.fields?.forEach(field => {
      const placeholder = `{{${field.name}}}`;
      if (!bbcode.includes(placeholder)) return;

      let value = formValues[field.name] ?? "";

      if (field.type === "image_upload" && value) value = `[img]${value}[/img]`;
      else if (field.type === "checkbox" && typeof value === "boolean") value = value ? "Yes" : "No";
      else if (field.type === "multi_select" && Array.isArray(value)) value = value.join(", ");
      else if (["dateTime", "pronouncedTimeOfDeath"].includes(field.name)) value = value.split("T")[0] || value;

      const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      bbcode = bbcode.replace(new RegExp(escaped, "g"), String(value));
    });

    // ──────────────────────────────────────────────────────────────
    // 6. JS EXPRESSIONS — LAST
    // ──────────────────────────────────────────────────────────────
    bbcode = bbcode.replace(/{{(.+?)}}/g, (match, expr) => {
      const trimmed = expr.trim();
      if (trimmed.includes(":") && !/[+\-*/()]/g.test(trimmed)) return trimmed;

      try {
        const fn = new Function('ctx', 'getDepartmentFullName', 'agencyDataStore', 'generateDecedentBBCode',
          `with (ctx) { return ${trimmed}; }`
        );
        const result = fn(ctx, getDepartmentFullName, agencyDataStore, generateDecedentBBCode);
        return Array.isArray(result) ? result.join(", ") : String(result || "");
      } catch (e) {
        console.warn("Expression failed:", trimmed, e);
        return "";
      }
    });

    // ──────────────────────────────────────────────────────────────
    // FINAL OUTPUT
    // ──────────────────────────────────────────────────────────────
    setGeneratedBBCode(bbcode);
    setShowBBCode(true);
  }, [selectedForm, formValues, agencyDataStore]);

  return {
    generatedBBCode,
    generatedTitle,
    showBBCode,
    setShowBBCode,
    generateBBCode,
  };
};

export default useBbcodeGenerator;