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
    // Try to match phpBB t= parameter first
    const tMatch = url.match(/[?&]t=(\d+)/);
    if (tMatch) return tMatch[1];
    
    const match = url.match(/\d+$/);
    return match ? match[0] : '';
  };

  const generateBBCode = useCallback(() => {
    if (!selectedForm?.template) {
      setGeneratedBBCode("");
      setGeneratedTitle(""); // ← Correct setter
      return;
    }

    // Process formValues to extract primitive values from select objects
    const processedFormValues = Object.entries(formValues).reduce((acc, [key, value]) => {
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) && // Do not flatten arrays
        value.hasOwnProperty('value') &&
        value.hasOwnProperty('label')
      ) {
        acc[key] = value.value;
      } else {
        acc[key] = value;
      }
      return acc;
    }, {});

    // Ensure all template variables are initialized to prevent ReferenceErrors.
    // This dynamically finds all `{{variable}}` placeholders in the template.
    const placeholders = new Set(selectedForm.template.match(/\{\{([a-zA-Z0-9_]+)\}\}/g)?.map(p => p.replace(/[{}]/g, '')) || []);
    placeholders.forEach(key => {
      if (processedFormValues[key] === undefined) {
        processedFormValues[key] = '';
      }
    });

    // Custom handling for 'Patient Files' category to auto-populate date
    if (selectedForm?.category === 'Patient Files') {
        if (!processedFormValues.date) {
            processedFormValues.date = formatToNorthAmericanDate(new Date().toISOString());
        }
    }

    // Custom handling for request-medical-files form to inject OAuth names
    if (selectedForm?.id === 'request-medical-files' && gtaWorldUser) {
      let oauthFirstName = gtaWorldUser?.faction?.firstname || gtaWorldUser?.activeCharacter?.firstname || null;
      let oauthLastName = gtaWorldUser?.faction?.lastname || gtaWorldUser?.activeCharacter?.lastname || null;

      // If OAuth names are null/empty, try to derive from patientName if available in formValues
      if ((!oauthFirstName || !oauthLastName) && processedFormValues.patientName) {
        const patientNameParts = String(processedFormValues.patientName).trim().split(' ');
        if (patientNameParts.length > 0) {
          oauthFirstName = patientNameParts[0];
          oauthLastName = patientNameParts.slice(1).join(' '); // Handle multi-word last names
        }
      }

      if (oauthFirstName && !processedFormValues.patientFirstName) {
        processedFormValues.patientFirstName = oauthFirstName;
      }
      if (oauthLastName && !processedFormValues.patientLastName) {
        processedFormValues.patientLastName = oauthLastName;
      }
    }

    // Custom handling for 'Coroner Report' / 'death-record' to map decedent location to placeOfDeath
    if ((selectedForm?.name === 'Coroner Report' || selectedForm?.id === 'death-record') && !processedFormValues.placeOfDeath) {
        if (Array.isArray(processedFormValues.decedents) && processedFormValues.decedents.length > 0) {
            const firstDecedent = processedFormValues.decedents[0];
            if (firstDecedent && firstDecedent.decedentLocation) {
                processedFormValues.placeOfDeath = firstDecedent.decedentLocation;
            }
        }
    }

    console.log("%c=== BBCODE & TITLE GENERATION STARTED ===", "font-weight:bold;color:#0066cc");
    console.log("Form:", selectedForm.name, `(${selectedForm.firebaseKey || selectedForm.id})`);
    console.log("Processed Form Values:", JSON.parse(JSON.stringify(processedFormValues)));

    let bbcode = selectedForm.template;
    let finalTitle = "";

    const ctx = { ...processedFormValues };
    ctx.formData = ctx;
    ctx.generateDecedentBBCode = (arr) => generateDecedentBBCode(arr, finalSelectOptions);

    // Directly generate and replace the decedents BBCode
    const decedents_bbcode = generateDecedentBBCode(processedFormValues.decedents, finalSelectOptions);
    console.log("Generated Decedents BBCode:", decedents_bbcode);
    bbcode = bbcode.replace('{{decedents_array_bbcode}}', decedents_bbcode);

    // Fallback aliases
    const addFallback = (src, target) => {
      if (processedFormValues[src] !== undefined && ctx[target] === undefined) ctx[target] = processedFormValues[src];
    };
    addFallback('patientName', 'PatientName'); addFallback('PatientName', 'patientName');
    addFallback('employeeName', 'EmployeeName'); addFallback('EmployeeName', 'employeeName');
    addFallback('phmcEmployee', 'PHMCEmployee'); addFallback('PHMCEmployee', 'phmcEmployee');
    addFallback('coronerEmployee', 'CoronerEmployee'); addFallback('CoronerEmployee', 'coronerEmployee');

    // ===================================================================
    // TITLE GENERATION
    // ===================================================================
    console.log("%cTITLE GENERATION PHASE", "font-weight:bold;color:#d35400;font-size:14px");

if (selectedForm.name === "Coroner Email" || selectedForm.id === "coroner_email") {
      let decedentName = processedFormValues.decedentName || processedFormValues.patientName || "UNKNOWN DECEDENT";
      const decedentOOC = processedFormValues.decedentOOC || "N/A";

      // NEW: Clean decedentName if it contains OOC info/dates
      const cleanedDecedentNameMatch = String(decedentName).match(/^(.*?)(?:\s*\(.*|\s*\[.*)/);
      if (cleanedDecedentNameMatch && cleanedDecedentNameMatch[1]) {
        decedentName = cleanedDecedentNameMatch[1].trim();
      }

      finalTitle = `Coroner Report - ${decedentName} ((${decedentOOC}))`;

    }
        else if (selectedForm.firebaseKey === 'mass-ftality-test' || selectedForm.id === 'mass-fatality') {
      const decedentCounts = {};
      let validCount = 0;

      if (Array.isArray(processedFormValues.decedents)) {
        processedFormValues.decedents.forEach((d, i) => {
          const name = (d.decedentName || '').trim();
          if (name) {
            decedentCounts[name] = (decedentCounts[name] || 0) + 1;
            validCount++;
          }
        });
      }

      const namesList = Object.entries(decedentCounts)
        .map(([n, c]) => c > 1 ? `${n} (x${c})` : n)
        .join(' | ') || 'No Decedents Listed';

      const dateStr = formatToNorthAmericanDate(processedFormValues.dateTime) || 'NO_DATE';

      finalTitle = `[Mass Fatality Report] ${namesList} - ${dateStr}`;
    }
    else if (selectedForm.firebaseKey === 'death-record' || selectedForm.id === 'death-record' || selectedForm.name === 'Death Record') {
      const year = new Date().getFullYear();
      const caseNum = parseCaseNumber(processedFormValues.deathReportPostId) || parseCaseNumber(processedFormValues.caseNumber) || 'UNKNOWN';
      const name = processedFormValues.decedentName || 'UNKNOWN_NAME';
      const ooc = processedFormValues.decedentOOC || 'N/A';
      const dod = formatToMMM_DD_YYYY(processedFormValues.dateOfDeath || processedFormValues.dateTime);

      finalTitle = `[CASE-#${year}-${caseNum}] ${name} ((${ooc} | ${dod}))`;
    }
    
    else if (selectedForm.titleGeneratorCode) {
      let workingTitle = selectedForm.titleGeneratorCode;

      selectedForm.fields?.forEach(field => {
        const placeholder = `{{${field.name}}}`;
        if (workingTitle.includes(placeholder)) {
          let value = processedFormValues[field.name] ?? "";

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
        }
      });
      // Fallback: also replace common known common ones even if not in fields list
      const fallbackTitleReplacements = {
        '{{patientName}}': processedFormValues.patientName || processedFormValues.decedentName || "NO_NAME",
        '{{PatientName}}': processedFormValues.patientName || processedFormValues.decedentName || "NO_NAME",
        '{{patientID}}': processedFormValues.patientID || "NO_ID",
        '{{phmcEmployee}}': processedFormValues.phmcEmployee || "",
        '{{date}}': formatToNorthAmericanDate(processedFormValues.dateTime || processedFormValues.date) || "NO_DATE",
        '{{agency}}': processedFormValues.agency || "",
        '{{year}}': new Date().getFullYear(),
      };

      Object.entries(fallbackTitleReplacements).forEach(([ph, val]) => {
        if (workingTitle.includes(ph)) {
          workingTitle = workingTitle.replace(
            new RegExp(ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            String(val)
          );
        }
      });

      finalTitle = workingTitle;
      console.log("%cFINAL TITLE → " + finalTitle, "color:#2ecc71;font-weight:bold;background:#000;padding:2px 6px");
      
    }    // ===================================================================    
    // 1. CHECKBOXES WITH OPTIONS (e.g., [cb:fieldName]Option[/cb], [cb:fieldName])
    // ===================================================================

    bbcode = bbcode.replace(/\[cb:([^\]]+)\]([^\r\n]*)(\r?\n)?/g, (match, fieldName, text, newline) => {
      const field = fieldName.trim();
      const option = text.trim();
      if (!field || !option) return match;

      const value = processedFormValues[field];
      let comparisonValue = value;

      if (typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, 'value')) {
          comparisonValue = value.value;
      }

      let isSelected = false;
      if (Array.isArray(comparisonValue)) {
        isSelected = comparisonValue.map(v => String(v).trim()).includes(option);
      } else {
        isSelected = String(comparisonValue || '').trim() === option;
      }
      
      const replacementTag = isSelected ? `[cbc]` : `[cb]`;
      const trailingNewline = newline || '';
      return `${replacementTag} ${option}${trailingNewline}`;
    });

    bbcode = bbcode.replace(/\[cb:([^\]]+)\]/gi, (match, fieldName) => {
      const field = fieldName.trim();
      const value = processedFormValues[field];
      const hasValue = value && (!Array.isArray(value) || value.length > 0);
      return hasValue ? "[cbc]" : "[cb]";
    });

    // ──────────────────────────────────────────────────────────────
    // 4. CONDITIONAL BLOCKS - FIELD PRESENCE ONLY (e.g., [conditional field="someField"])
    // ──────────────────────────────────────────────────────────────
    bbcode = bbcode.replace(/\[conditional\s+field=["']?([^"'\]\s]+)["']?\](.*?)\[\/conditional\]/gis, (match, fieldName, inner) => {
      const field = fieldName.trim();
      const currentValue = processedFormValues[field];
      
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
      const currentValue = processedFormValues[field];

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
    // 4.5. FIELD WITH PLACEHOLDER (e.g., {{fieldName|Placeholder Text}})
    // ──────────────────────────────────────────────────────────────
    bbcode = bbcode.replace(/\{\{([a-zA-Z0-9_]+)\|((?:(?!}}).)+)\}\}/g, (match, key, placeholderText) => {
        const value = processedFormValues[key];
        let replacement = '';
        
        // Determine if we should use the value or the placeholder
        // Treating null, undefined, empty string, false, and empty arrays as "empty"
        const isEmpty = value === null || 
                        value === undefined || 
                        value === '' || 
                        value === false || 
                        (Array.isArray(value) && value.length === 0);

        if (isEmpty) {
            replacement = placeholderText;
            console.debug(`[BbcodeGenerator] Field '${key}' is empty/false. Using placeholder: '${placeholderText}'`);
        } else {
             // Logic matched from Section 5 for formatting
            replacement = String(value);
            const field = selectedForm.fields?.find(f => f.name === key);

            if (field) {
                if ((field.type === "image" || field.type === "image_upload") && value) {
                     // Image formatting logic
                    const isImageUrl = (url) => typeof url === 'string' && /\.(jpg|jpeg|png|gif|webp)$/i.test(url.trim());
                    const formatItem = (item) => (typeof item === 'string' && isImageUrl(item)) ? `[img]${item}[/img]` : (item || '');
                    
                    if (Array.isArray(value)) {
                        replacement = value.map(formatItem).filter(Boolean).join('\n');
                    } else if (typeof value === 'string') {
                        replacement = formatItem(value);
                    }
                }
                else if (field.type === "checkbox" && typeof value === "boolean") {
                    replacement = value ? "Yes" : "No";
                } 
                else if (field.type === "multi_select" && Array.isArray(value)) {
                    replacement = value.join(", ");
                }
                else if (field.type === "dynamic_text_list" && Array.isArray(value)) {
                    const items = value.filter(val => val && String(val).trim() !== "");
                    if (items.length > 0) {
                        if (field.listType === "none") {
                            replacement = items.join("\n");
                        } else {
                            const listOpen = (field.listType && field.listType !== "") ? `[list=${field.listType}]` : "[list]";
                            replacement = `${listOpen}\n[*]${items.join("\n[*]")}\n[/list]`;
                        }
                    } else {
                        replacement = "";
                    }
                }
                else if (["dateTime", "pronouncedTimeOfDeath"].includes(field.name)) {
                    replacement = String(value).split("T")[0] || String(value);
                }
                else if (field.type === "medicine_block" && value && typeof value === 'object') {
                    const prescribedText = value.prescribed || "None";
                    let proofImages = "";
                    if (Array.isArray(value.proof) && value.proof.length > 0) {
                        proofImages = "\n" + value.proof.map(url => `[img]${url}[/img]`).join("\n");
                    }
                    replacement = `${prescribedText}${proofImages}`;
                }
            }
             // Handle objects (like payment buttons)
            if (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, 'confirmedAt')) {
                replacement = String(value.confirmedAt);
            }
        }
        return replacement;
    });

    // ──────────────────────────────────────────────────────────────
    // 5. FIELD REPLACEMENT — NOW BASED ON VALUES, NOT FIELD DEFS
    // ──────────────────────────────────────────────────────────────
    Object.keys(processedFormValues).forEach(key => {
        const placeholder = `{{${key}}}`;
        if (!bbcode.includes(placeholder)) return;

        const value = processedFormValues[key];
        const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        let replacement = String(value ?? ''); // Default to string representation

        // Find the field definition to apply special formatting if it exists
        const field = selectedForm.fields?.find(f => f.name === key);

        if (field) {
            if ((field.type === "image" || field.type === "image_upload") && value) {
                const isImageUrl = (url) => {
                    if (typeof url !== 'string') return false;
                    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url.trim());
                };
                const formatItem = (item) => {
                    if (typeof item === 'string' && isImageUrl(item)) {
                        return `[img]${item}[/img]`;
                    }
                    return item || '';
                };
                if (Array.isArray(value)) {
                    replacement = value.map(formatItem).filter(Boolean).join('\n');
                } else if (typeof value === 'string') {
                    replacement = formatItem(value);
                }
            }
            else if (field.type === "checkbox" && typeof value === "boolean") {
                replacement = value ? "Yes" : "No";
            } 
            else if (field.type === "multi_select" && Array.isArray(value)) {
                replacement = value.join(", ");
            }
            else if (field.type === "dynamic_text_list" && Array.isArray(value)) {
                const items = value.filter(val => val && String(val).trim() !== "");
                if (items.length > 0) {
                    if (field.listType === "none") {
                        replacement = items.join("\n");
                    } else {
                        const listOpen = (field.listType && field.listType !== "") ? `[list=${field.listType}]` : "[list]";
                        replacement = `${listOpen}\n[*]${items.join("\n[*]")}\n[/list]`;
                    }
                } else {
                    replacement = "";
                }
            }
            else if (["dateTime", "pronouncedTimeOfDeath"].includes(field.name)) {
                replacement = String(value).split("T")[0] || String(value);
            }
            else if (field.type === "medicine_block" && value && typeof value === 'object') {
                const prescribedText = value.prescribed || "None";
                let proofImages = "";
                if (Array.isArray(value.proof) && value.proof.length > 0) {
                    proofImages = "\n" + value.proof.map(url => `[img]${url}[/img]`).join("\n");
                }
                replacement = `${prescribedText}${proofImages}`;
            }
        }        
        // This handles cases where value is an object, like from payment buttons
        if (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, 'confirmedAt')) {
            replacement = String(value.confirmedAt);
        }

        bbcode = bbcode.replace(new RegExp(escaped, "g"), replacement);
    });

    // ──────────────────────────────────────────────────────────────
    // 6. JS EXPRESSIONS — LAST
    // ──────────────────────────────────────────────────────────────
    bbcode = bbcode.replace(/{{(.+?)}}/g, (match, expr) => {
      const trimmed = expr.trim();
      if (trimmed.includes(":") && !/[+\-*/()=?<>!&|]/g.test(trimmed)) return trimmed;

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

    // --- Consistency Check: Form Values vs. OAuth Data (Employee Credentials) ---
    if (gtaWorldUser) {
      const employeeTypeLower = selectedForm?.accessType?.toLowerCase(); // 'coroner' or 'phmc'

      if (employeeTypeLower === 'coroner' || employeeTypeLower === 'phmc') {
        const formEmployeeName = processedFormValues[`${employeeTypeLower}Employee`];
        const formEmployeeRank = processedFormValues[`${employeeTypeLower}Rank`];

        // OAuth data can come from faction or activeCharacter
        const oauthEmployeeName = gtaWorldUser.faction?.name || gtaWorldUser.activeCharacter?.characterName;
        const oauthEmployeeRank = gtaWorldUser.faction?.rank || 'N/A'; // Rank might be less directly available for non-faction activeCharacter

        if (formEmployeeName && oauthEmployeeName && formEmployeeName !== oauthEmployeeName) {
            console.warn(`[BbcodeGenerator] Consistency Warning: Form Employee Name (${formEmployeeName}) does not match OAuth Name (${oauthEmployeeName}).`);
        }

        if (formEmployeeRank && oauthEmployeeRank && formEmployeeRank !== oauthEmployeeRank) {
             // Rank comparison is tricky due to formatting (spaces vs underscores), so maybe just a debug log
             // console.debug(`[BbcodeGenerator] Rank mismatch check: Form(${formEmployeeRank}) vs OAuth(${oauthEmployeeRank})`);
        }
      }
    }
    // --- End Consistency Check ---

    // Final Polish: Convert internal [bold] to standard [b]
    // This is specifically required for Coroner Email only as it consumes standard BBCode.
    const isCoronerEmail = selectedForm.name === "Coroner Email" || selectedForm.id === "coroner_email";
    if (isCoronerEmail && (bbcode.includes('[bold]') || bbcode.includes('[/bold]'))) {
        bbcode = bbcode.replace(/\[bold\]/gi, '[b]').replace(/\[\/bold\]/gi, '[/b]');
    }

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