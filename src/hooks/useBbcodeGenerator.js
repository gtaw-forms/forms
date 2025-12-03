// src/hooks/useBbcodeGenerator.js
import { useState, useCallback } from 'react';
import { getUtcFormattedDateTime } from '../utils/dateTimeUtils';
import { getDepartmentFullName } from '../utils/bbcodeHelpers';
import generateDecedentBBCode from '../phmc-bbcode-generators/generateMassFatality';

const useBbcodeGenerator = (selectedForm, formValues, finalSelectOptions, agencyDataStore, gtaWorldUser) => {
  const [generatedBBCode, setGeneratedBBCode] = useState("");
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [showBBCode, setShowBBCode] = useState(false);

const formatToNorthAmericanDate = (isoDateTime) => {
    if (!isoDateTime) return 'NO_DATE';
    try {
      const date = new Date(isoDateTime);
      if (isNaN(date.getTime())) {
        // Fallback: try parsing YYYY-MM-DD manually
        const parts = isoDateTime.split('T')[0].split('-');
        if (parts.length === 3) {
          const reconstructed = new Date(parts[0], parts[1] - 1, parts[2]);
          if (!isNaN(reconstructed.getTime())) {
            return `${(reconstructed.getMonth() + 1).toString().padStart(2, '0')}/${reconstructed.getDate().toString().padStart(2, '0')}/${reconstructed.getFullYear()}`;
          }
        }
        return 'INVALID_DATE';
      }
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    } catch (e) {
      console.error("Error in formatToNorthAmericanDate:", e);
      return 'ERROR_DATE';
    }
  };
  const formatToMMM_DD_YYYY = (isoDateTime) => {
    if (!isoDateTime) return 'NO_DATE';
    try {
      const date = new Date(isoDateTime);
      if (isNaN(date.getTime())) {
        const parts = isoDateTime.split('T')[0].split('-');
        if (parts.length === 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
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
      return isoDateTime || 'INVALID_DATE';
    }
  };

  const parseCaseNumber = (url) => {
    if (!url) return '';
    const match = url.match(/\d+$/);
    return match ? match[0] : '';
  };

  const generateBBCode = useCallback(() => {
    if (!selectedForm?.template) {
      console.log("No template found. Skipping generation.");
      setGeneratedBBCode("");
      setGeneratedTitle(""); // ← Correct setter
      return;
    }

    console.log("%c=== BBCODE & TITLE GENERATION STARTED ===", "font-weight:bold;color:#0066cc");
    console.log("Form:", selectedForm.name, `(${selectedForm.firebaseKey || selectedForm.id})`);
    console.log("Form Values:", JSON.parse(JSON.stringify(formValues)));
    console.log("Initial selectedForm.template:", selectedForm.template);

    let bbcode = selectedForm.template;
    let finalTitle = "";

    const ctx = { ...formValues };
    ctx.formData = ctx;
    ctx.generateDecedentBBCode = (arr) => generateDecedentBBCode(arr, finalSelectOptions);
    ctx.decedents_array_bbcode = ctx.generateDecedentBBCode(ctx.decedents);

    // Fallback aliases
    const addFallback = (src, target) => {
      if (formValues[src] !== undefined && ctx[target] === undefined) ctx[target] = formValues[src];
    };
    addFallback('patientName', 'PatientName'); addFallback('PatientName', 'patientName');
    addFallback('employeeName', 'EmployeeName'); addFallback('EmployeeName', 'employeeName');
    addFallback('phmcEmployee', 'PHMCEmployee'); addFallback('PHMCEmployee', 'phmcEmployee');
    addFallback('coronerEmployee', 'CoronerEmployee'); addFallback('CoronerEmployee', 'coronerEmployee');

    // ===================================================================
    // TITLE GENERATION – DETAILED DEBUG LOGS
    // ===================================================================
    console.log("%cTITLE GENERATION PHASE", "font-weight:bold;color:#d35400;font-size:14px");

if (selectedForm.name === "Coroner Email" || selectedForm.id === "coroner_email") {
      console.log("%cCORONER EMAIL TITLE LOGIC MATCHED", "color:#e74c3c;font-weight:bold");

      const decedentName = formValues.decedentName || formValues.patientName || "UNKNOWN DECEDENT";
      const decedentOOC = formValues.decedentOOC || "N/A";

      finalTitle = `Coroner Report - ${decedentName} | ((${decedentOOC}))`;

      console.log("Coroner Email Title Inputs:", { decedentName, decedentOOC });
      console.log("%cFinal Coroner Email Title → " + finalTitle, "color:#2ecc71;font-weight:bold");

    }
        else if (selectedForm.firebaseKey === 'mass-ftality-test' || selectedForm.id === 'mass-fatality') {
      console.log("%cMatched: Mass Fatality Report Title", "color:#8e44ad;font-weight:bold");

      const decedentCounts = {};
      let validCount = 0;

      if (Array.isArray(formValues.decedents)) {
        formValues.decedents.forEach((d, i) => {
          const name = (d.decedentName || '').trim();
          console.log(`Decedent[${i}]:`, name || "(empty)");
          if (name) {
            decedentCounts[name] = (decedentCounts[name] || 0) + 1;
            validCount++;
          }
        });
      }

      const namesList = Object.entries(decedentCounts)
        .map(([n, c]) => c > 1 ? `${n} (x${c})` : n)
        .join(' | ') || 'No Decedents Listed';

      const dateStr = formatToNorthAmericanDate(formValues.dateTime) || 'NO_DATE';

      finalTitle = `[Mass Fatality Report] ${namesList} - ${dateStr}`;
      console.log("%cFinal Mass Fatality Title → " + finalTitle, "color:#27ae60;font-weight:bold");
 // ← FIXED
    }
    else if (selectedForm.firebaseKey === 'death-record' || selectedForm.id === 'death-record') {
      console.log("%cMatched: Death Record Title", "color:#2980b9;font-weight:bold");

      const year = new Date().getFullYear();
      const caseNum = parseCaseNumber(formValues.deathReportPostId) || parseCaseNumber(formValues.caseNumber) || 'UNKNOWN';
      const name = formValues.decedentName || 'UNKNOWN_NAME';
      const ooc = formValues.decedentOOC || 'N/A';
      const dod = formatToMMM_DD_YYYY(formValues.dateOfDeath || formValues.dateTime);

      finalTitle = `[CASE-#${year}-${caseNum}] ${name} ((${ooc} | ${dod}))`;
      console.log("%cFinal Death Record Title → " + finalTitle, "color:#27ae60;font-weight:bold");
 // ← FIXED
    }
    
    else if (selectedForm.titleGeneratorCode) {
      console.log("%cGENERIC titleGeneratorCode TEMPLATE", "color:#1abc9c;font-weight:bold");
      console.log("Raw title template:", selectedForm.titleGeneratorCode);

      let workingTitle = selectedForm.titleGeneratorCode;

      console.log("%cSAFETY NET: Pre-replacing all form fields in TITLE", "color:#f39c12;font-weight:bold");

      selectedForm.fields?.forEach(field => {
        const placeholder = `{{${field.name}}}`;
        if (workingTitle.includes(placeholder)) {
          let value = formValues[field.name] ?? "";

          // Handle special types
          if (field.type === "image_upload" && value) value = `[img]${value}[/img]`;
          else if (field.type === "checkbox") value = value ? "Yes" : "No";
          else if (field.type === "multi_select" && Array.isArray(value)) value = value.join(", ");
          else if (["date", "dateTime", "pronouncedTimeOfDeath"].includes(field.name)) {
            value = formatToNorthAmericanDate(value) || value || "NO_DATE";
          }


          const safeValue = String(value || "");
          workingTitle = workingTitle.replace(
            new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            safeValue
          );
          console.log(`Title pre-replaced ${placeholder} → "${safeValue}"`);
        }
      });
      // Fallback: also replace common known common ones even if not in fields list
      const fallbackTitleReplacements = {
        '{{patientName}}': formValues.patientName || formValues.decedentName || "NO_NAME",
        '{{PatientName}}': formValues.patientName || formValues.decedentName || "NO_NAME",
        '{{patientID}}': formValues.patientID || "NO_ID",
        '{{phmcEmployee}}': formValues.phmcEmployee || "",
        '{{date}}': formatToNorthAmericanDate(formValues.dateTime || formValues.date) || "NO_DATE",
        '{{agency}}': formValues.agency || "",
      };

      Object.entries(fallbackTitleReplacements).forEach(([ph, val]) => {
        if (workingTitle.includes(ph)) {
          workingTitle = workingTitle.replace(
            new RegExp(ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            String(val)
          );
          console.log(`Title fallback: ${ph} → "${val}"`);
        }
      });

      finalTitle = workingTitle;
      console.log("%cFINAL TITLE → " + finalTitle, "color:#2ecc71;font-weight:bold;background:#000;padding:2px 6px");

      
    }    // ===================================================================    
    // 1. CHECKBOXES WITH OPTIONS (e.g., [cb:fieldName]Option[/cb], [cb:fieldName])
    // ===================================================================

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
    // 4. CONDITIONAL BLOCKS - FIELD PRESENCE ONLY (e.g., [conditional field="someField"])
    // ──────────────────────────────────────────────────────────────
    bbcode = bbcode.replace(/\[conditional\s+field=["']?([^"'\]\s]+)["']?\](.*?)\[\/conditional\]/gis, (match, fieldName, inner) => {
      const field = fieldName.trim();
      const currentValue = formValues[field];
      
      let conditionMet = false;
      if (typeof currentValue === 'object' && currentValue !== null && Object.prototype.hasOwnProperty.call(currentValue, 'confirmedAt')) {
        // Special handling for payment confirmation objects
        conditionMet = !!currentValue.confirmedAt;
      } else {
        // General truthiness check for other fields
        conditionMet = !!currentValue;
      }
      
      return conditionMet ? inner.trim() : '';
    });

    // ──────────────────────────────────────────────────────────────
    // 5. CONDITIONAL BLOCKS - FIELD AND VALUE MATCHING (e.g., [conditional field="someField" value="expectedValue"])
    // ──────────────────────────────────────────────────────────────
    bbcode = bbcode.replace(/\[conditional\s+field=["']?([^"'\]\s]+)["']?\s+value=["']?([^"'\]]+)["']?\](.*?)\[\/conditional\]/gis, (match, fieldName, expectedValue, inner) => {
      const field = fieldName.trim();
      const expected = expectedValue.trim();
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


  return conditionMet ? inner.trim() : '';
});
    // ──────────────────────────────────────────────────────────────
    // 5. FIELD REPLACEMENT — SAFE PER-FIELD
    // ──────────────────────────────────────────────────────────────
    selectedForm.fields?.forEach(field => {
      const placeholder = `{{${field.name}}}`;
      if (!bbcode.includes(placeholder)) return;

      let value = formValues[field.name] ?? "";

      // Custom handling for payment confirmation objects during field replacement
      if (typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, 'confirmedAt')) {
        value = String(value.confirmedAt); // Extract the confirmedAt
      }
      // ... existing special handling for image_upload, checkbox, multi_select ...
      // Handle image fields (single or multiple)
      else if ((field.type === "image" || field.type === "image_upload") && value) {
        if (Array.isArray(value)) {
          value = value.map(url => url ? `[img]${url}[/img]` : '').filter(Boolean).join('\n'); // Join multiple images with newlines
        } else if (typeof value === 'string' && value) {
          value = `[img]${value}[/img]`;
        }
      }
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
        
        // Custom handling for payment confirmation objects to prevent "[object Object]"
        if (typeof result === 'object' && result !== null && Object.prototype.hasOwnProperty.call(result, 'confirmedAt')) {
          return String(result.confirmedAt);
        }

        return Array.isArray(result) ? result.join(", ") : String(result || "");
      } catch (e) {
        console.warn("Expression failed:", trimmed, e);
        return "";
      }
    });
    console.log("Final BBCode after syntaxing expressions:", bbcode);

    // --- Consistency Check: Form Values vs. OAuth Data (Employee Credentials) ---
    if (gtaWorldUser) {
      const employeeTypeLower = selectedForm?.accessType?.toLowerCase(); // 'coroner' or 'phmc'

      if (employeeTypeLower === 'coroner' || employeeTypeLower === 'phmc') {
        const formEmployeeName = formValues[`${employeeTypeLower}Employee`];
        const formEmployeeRank = formValues[`${employeeTypeLower}Rank`];

        // OAuth data can come from faction or activeCharacter
        const oauthEmployeeName = gtaWorldUser.faction?.name || gtaWorldUser.activeCharacter?.characterName;
        const oauthEmployeeRank = gtaWorldUser.faction?.rank || 'N/A'; // Rank might be less directly available for non-faction activeCharacter

        if (formEmployeeName && oauthEmployeeName && formEmployeeName !== oauthEmployeeName) {
          console.warn(
            `BBCode Generation Discrepancy (Name - ${employeeTypeLower.toUpperCase()}): ` +
            `Form has "${formEmployeeName}" but OAuth user is "${oauthEmployeeName}".`
          );
        }

        if (formEmployeeRank && oauthEmployeeRank && formEmployeeRank !== oauthEmployeeRank) {
          console.warn(
            `BBCode Generation Discrepancy (Rank - ${employeeTypeLower.toUpperCase()}): ` +
            `Form has "${formEmployeeRank}" but OAuth user rank is "${oauthEmployeeRank}".`
          );
        }
      }
    }
    // --- End Consistency Check ---

    setShowBBCode(true);
    setGeneratedBBCode(bbcode);
    setGeneratedTitle(finalTitle); // Set the accumulated finalTitle here

    console.log("%cGENERATION COMPLETE", "font-weight:bold;color:#0066cc");
    console.log("Title:", finalTitle);
  }, [selectedForm, formValues, finalSelectOptions, agencyDataStore, gtaWorldUser]);

  return {
    generatedBBCode,
    generatedTitle,
    showBBCode,
    setShowBBCode,
    generateBBCode,
  };
};

export default useBbcodeGenerator;