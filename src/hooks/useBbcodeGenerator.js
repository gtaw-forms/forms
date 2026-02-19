// src/hooks/useBbcodeGenerator.js
import { useState, useCallback } from 'react';
import { getUtcFormattedDateTime } from '../utils/dateTimeUtils';
import { getDepartmentFullName } from '../utils/bbcodeHelpers';
import generateDecedentBBCode from '../phmc-bbcode-generators/generateMassFatality';

const useBbcodeGenerator = (selectedForm, formValues, finalSelectOptions, agencyDataStore, gtaWorldUser) => {
  const [generatedBBCode, setGeneratedBBCode] = useState("");
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [showBBCode, setShowBBCode] = useState(false);
  // const [limitWarning, setLimitWarning] = useState("");

const formatToNorthAmericanDate = (isoDateTime) => {
    if (!isoDateTime) return 'NO_DATE';
    try {
        const dateString = isoDateTime.split('T')[0]; // "YYYY-MM-DD"
        const parts = dateString.split('-'); // ["YYYY", "MM", "DD"]
        let date;

        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
            const day = parseInt(parts[2], 10);
            // Construct date in local timezone to avoid UTC interpretation
            date = new Date(year, month, day);
        } else {
            // If it's not a YYYY-MM-DD string, try parsing the full isoDateTime
            date = new Date(isoDateTime);
        }

        if (!isNaN(date.getTime())) {
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${month}/${day}/${year}`;
        }
        
        return 'INVALID_DATE'; // Fallback
    } catch (e) {
        console.error("Error in formatToNorthAmericanDate:", e);
        return 'ERROR_DATE';
    }
};
  const formatToMMM_DD_YYYY = (isoDateTime) => {
    if (!isoDateTime) return 'NO_DATE';
    try {
        const dateString = isoDateTime.split('T')[0]; // "YYYY-MM-DD"
        const parts = dateString.split('-'); // ["YYYY", "MM", "DD"]
        let date;

        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
            const day = parseInt(parts[2], 10);
            // Construct date in local timezone to avoid UTC interpretation
            date = new Date(year, month, day);
        } else {
            // If it's not a YYYY-MM-DD string, try parsing the full isoDateTime
            date = new Date(isoDateTime);
        }

        if (!isNaN(date.getTime())) {
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const month = monthNames[date.getMonth()];
            const day = date.getDate().toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${month}-${day}-${year}`;
        }
        
        return isoDateTime; // Fallback to original string if all parsing fails
    } catch (e) {
        console.error("Error formatting date for title (MMM-DD-YYYY):", e);
        return isoDateTime || 'INVALID_DATE';
    }
  };  const parseCaseNumber = (url) => {
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
      setGeneratedTitle(""); 
      setLimitWarning("");
      return;
    }

    const PHPBB_LIMIT = 60000;
    const isMassFatality = selectedForm.firebaseKey === 'mass-ftality-test' || selectedForm.id === 'mass-fatality' || selectedForm.name?.toLowerCase().includes('mass fatality');

    const performGeneration = (decedentsOverride = null) => {
      // Process formValues to extract primitive values from select objects
      const processedFormValues = Object.entries(formValues).reduce((acc, [key, value]) => {
        if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value) && 
          Object.prototype.hasOwnProperty.call(value, 'value') &&
          Object.prototype.hasOwnProperty.call(value, 'label')
        ) {
          acc[key] = value.value;
        } else {
          acc[key] = value;
        }
        return acc;
      }, {});

      // Ensure all template variables are initialized
      const placeholders = new Set(selectedForm.template.match(/\{\{([a-zA-Z0-9_]+)\}\}/g)?.map(p => p.replace(/[{}]/g, '')) || []);
      placeholders.forEach(key => {
        if (processedFormValues[key] === undefined) {
          processedFormValues[key] = '';
        }
      });

      // Normalize decedents if it's an object-based array
      if (processedFormValues.decedents && typeof processedFormValues.decedents === 'object' && !Array.isArray(processedFormValues.decedents)) {
          processedFormValues.decedents = Object.values(processedFormValues.decedents);
      }
      
      // Apply override if provided
      if (decedentsOverride) {
          processedFormValues.decedents = decedentsOverride;
      }

      // Custom handling for request-medical-files form to inject OAuth names
      if (selectedForm?.id === 'request-medical-files' && gtaWorldUser) {
        let oauthFirstName = gtaWorldUser?.faction?.firstname || gtaWorldUser?.activeCharacter?.firstname || null;
        let oauthLastName = gtaWorldUser?.faction?.lastname || gtaWorldUser?.activeCharacter?.lastname || null;

        if ((!oauthFirstName || !oauthLastName) && processedFormValues.patientName) {
          const patientNameParts = String(processedFormValues.patientName).trim().split(' ');
          if (patientNameParts.length > 0) {
            oauthFirstName = patientNameParts[0];
            oauthLastName = patientNameParts.slice(1).join(' '); 
          }
        }

        if (oauthFirstName && !processedFormValues.patientFirstName) {
          processedFormValues.patientFirstName = oauthFirstName;
        }
        if (oauthLastName && !processedFormValues.patientLastName) {
          processedFormValues.patientLastName = oauthLastName;
        }
      }

      if ((selectedForm?.name === 'Coroner Report' || selectedForm?.id === 'death-record') && !processedFormValues.placeOfDeath) {
          if (Array.isArray(processedFormValues.decedents) && processedFormValues.decedents.length > 0) {
              const firstDecedent = processedFormValues.decedents[0];
              if (firstDecedent && firstDecedent.decedentLocation) {
                  processedFormValues.placeOfDeath = firstDecedent.decedentLocation;
              }
          }
      }

      let bbcode = selectedForm.template;
      let finalTitle = "";

      const ctx = { ...processedFormValues };
      ctx.formData = ctx;
      ctx.generateDecedentBBCode = (arr) => generateDecedentBBCode(arr, finalSelectOptions);

      const decedents_bbcode = generateDecedentBBCode(processedFormValues.decedents, finalSelectOptions);
      bbcode = bbcode.replace('{{decedents_array_bbcode}}', decedents_bbcode);

      const addFallback = (src, target) => {
        if (processedFormValues[src] !== undefined && ctx[target] === undefined) ctx[target] = processedFormValues[src];
      };
      addFallback('patientName', 'PatientName'); addFallback('PatientName', 'patientName');
      addFallback('employeeName', 'EmployeeName'); addFallback('EmployeeName', 'employeeName');
      addFallback('phmcEmployee', 'PHMCEmployee'); addFallback('PHMCEmployee', 'phmcEmployee');
      addFallback('coronerEmployee', 'CoronerEmployee'); addFallback('CoronerEmployee', 'coronerEmployee');

      if (selectedForm.name === "Coroner Email" || selectedForm.id === "coroner_email") {
        let decedentName = processedFormValues.decedentName || processedFormValues.patientName || "UNKNOWN DECEDENT";
        const decedentOOC = processedFormValues.decedentOOC || "N/A";
        const cleanedDecedentNameMatch = String(decedentName).match(/^(.*?)(?:\s*\(.*|\s*\[.*)/);
        if (cleanedDecedentNameMatch && cleanedDecedentNameMatch[1]) {
          decedentName = cleanedDecedentNameMatch[1].trim();
        }
        finalTitle = `Coroner Report - ${decedentName} ((${decedentOOC}))`;
      }
      else if (selectedForm.firebaseKey === 'mass-ftality-test' || selectedForm.id === 'mass-fatality' || selectedForm.name?.toLowerCase().includes('mass fatality')) {
        const decedentCounts = {};
        let totalDecedents = 0;
        if (Array.isArray(processedFormValues.decedents)) {
          totalDecedents = processedFormValues.decedents.length;
          processedFormValues.decedents.forEach((d) => {
            const name = (d.decedentName || '').trim();
            if (name) {
              decedentCounts[name] = (decedentCounts[name] || 0) + 1;
            }
          });
        }
        const namesList = Object.entries(decedentCounts)
          .map(([n, c]) => c > 1 ? `${n} (x${c})` : n)
          .join(' | ') || 'No Decedents Listed';
        const dateStr = formatToNorthAmericanDate(processedFormValues.dateTime) || 'NO_DATE';
        
        const reportType = totalDecedents >= 4 ? 'Mass Fatality' : 'Multi Fatality';
        finalTitle = `[${reportType} Report] ${namesList} - ${dateStr}`;
      }
      else if (selectedForm.firebaseKey === 'death-record' || selectedForm.id === 'death-record' || selectedForm.name === 'Death Record') {
        const year = new Date().getFullYear();
        const caseNum = parseCaseNumber(processedFormValues.deathReportPostId) || parseCaseNumber(processedFormValues.caseNumber) || 'UNKNOWN';
        const name = processedFormValues.decedentName || 'UNKNOWN_NAME';
        const ooc = processedFormValues.decedentOOC || 'N/A';
        const dod = formatToMMM_DD_YYYY(processedFormValues.dateOfDeath || processedFormValues.dateTime || processedFormValues.formattedDateOfDeath);
        finalTitle = `[CASE #${year}-${caseNum}] ${name} ((${ooc})) | ${dod}`;
      }
      else if (selectedForm.titleGeneratorCode) {
        let workingTitle = selectedForm.titleGeneratorCode;
        selectedForm.fields?.forEach(field => {
          const placeholder = `{{${field.name}}}`;
          if (workingTitle.includes(placeholder)) {
            let value = processedFormValues[field.name] ?? "";
            if (field.type === "image_upload" && value) value = `[img]${value}[/img]`;
            else if (field.type === "checkbox") value = value ? "Yes" : "No";
            else if (field.type === "multi_select" && Array.isArray(value)) value = value.join(", ");
            else if (["date", "dateTime", "pronouncedTimeOfDeath"].includes(field.name)) {
              value = formatToNorthAmericanDate(value) || value || "NO_DATE";
            }
            workingTitle = workingTitle.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value || ""));
          }
        });
        const fallbackTitleReplacements = {
          '{{patientName}}': processedFormValues.patientName || processedFormValues.decedentName || "NO_NAME",
          '{{PatientName}}': processedFormValues.patientName || processedFormValues.decedentName || "NO_NAME",
          '{{phmcEmployee}}': processedFormValues.phmcEmployee || "",
          '{{date}}': formatToNorthAmericanDate(processedFormValues.dateTime || processedFormValues.date) || "NO_DATE",
          '{{year}}': new Date().getFullYear(),
        };
        Object.entries(fallbackTitleReplacements).forEach(([ph, val]) => {
          if (workingTitle.includes(ph)) {
            workingTitle = workingTitle.replace(new RegExp(ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(val));
          }
        });
        finalTitle = workingTitle;
      }

      bbcode = bbcode.replace(/\[cb:([^\]]+)\]([^\r\n]*)(\r?\n)?/g, (match, fieldName, text, newline) => {
        const field = fieldName.trim();
        const option = text.trim();
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
        return `${isSelected ? `[cbc]` : `[cb]`} ${option}${newline || ''}`;
      });

      bbcode = bbcode.replace(/\[cb:([^\]]+)\]/gi, (match, fieldName) => {
        const value = processedFormValues[fieldName.trim()];
        return (value && (!Array.isArray(value) || value.length > 0)) ? "[cbc]" : "[cb]";
      });

      bbcode = bbcode.replace(/\[conditional\s+field=["']?([^"'\]\s]+)["']?\](.*?)\[\/conditional\]/gis, (match, fieldName, inner) => {
        const currentValue = processedFormValues[fieldName.trim()];
        let conditionMet = (typeof currentValue === 'object' && currentValue !== null && Object.prototype.hasOwnProperty.call(currentValue, 'confirmedAt')) ? !!currentValue.confirmedAt : !!currentValue;
        return conditionMet ? inner.trim() : '';
      });

      bbcode = bbcode.replace(/\[conditional\s+field=["']?([^"'\]\s]+)["']?\s+value=["']?([^"'\]]+)["']?\](.*?)\[\/conditional\]/gis, (match, fieldName, expectedValue, inner) => {
        const actualValue = processedFormValues[fieldName.trim()];
        const expected = expectedValue.trim();
        const conditionMet = Array.isArray(actualValue) ? actualValue.map(v => String(v)).includes(String(expected)) : String(actualValue) == String(expected);
        return conditionMet ? inner.trim() : '';
      });

      bbcode = bbcode.replace(/\{\{([a-zA-Z0-9_]+)\|((?:(?!}}).)+)\}\}/g, (match, key, placeholderText) => {
          const value = processedFormValues[key];
          const isEmpty = value === null || value === undefined || value === '' || value === false || (Array.isArray(value) && value.length === 0);
          if (isEmpty) return placeholderText;
          
          let replacement = String(value);
          const field = selectedForm.fields?.find(f => f.name === key);
          if (field) {
              if ((field.type === "image" || field.type === "image_upload") && value) {
                  const formatItem = (item) => (typeof item === 'string' && /\.(jpg|jpeg|png|gif|webp)$/i.test(item.trim())) ? `[img]${item}[/img]` : (item || '');
                  replacement = Array.isArray(value) ? value.map(formatItem).filter(Boolean).join('\n') : formatItem(value);
              }
              else if (field.type === "checkbox" && typeof value === "boolean") replacement = value ? "Yes" : "No";
              else if (field.type === "multi_select" && Array.isArray(value)) replacement = value.join(", ");
              else if (field.type === "dynamic_text_list" && Array.isArray(value)) {
                  const items = value.filter(val => val && String(val).trim() !== "");
                  if (items.length > 0) {
                      const listOpen = (field.listType && field.listType !== "" && field.listType !== "none") ? `[list=${field.listType}]` : "[list]";
                      replacement = field.listType === "none" ? items.join("\n") : `${listOpen}\n[*]${items.join("\n[*]")}\n[/list]`;
                  } else replacement = "";
              }
              else if (["dateTime", "pronouncedTimeOfDeath"].includes(field.name)) replacement = String(value).split("T")[0] || String(value);
          }
          return replacement;
      });

      Object.keys(processedFormValues).forEach(key => {
          const placeholder = `{{${key}}}`;
          if (!bbcode.includes(placeholder)) return;
          const value = processedFormValues[key];
          let replacement = String(value ?? '');
          const field = selectedForm.fields?.find(f => f.name === key);
          if (field) {
              if ((field.type === "image" || field.type === "image_upload") && value) {
                  const formatItem = (item) => (typeof item === 'string' && /\.(jpg|jpeg|png|gif|webp)$/i.test(item.trim())) ? `[img]${item}[/img]` : (item || '');
                  replacement = Array.isArray(value) ? value.map(formatItem).filter(Boolean).join('\n') : formatItem(value);
              }
              else if (field.type === "checkbox" && typeof value === "boolean") replacement = value ? "Yes" : "No";
              else if (field.type === "multi_select" && Array.isArray(value)) replacement = value.join(", ");
              else if (field.type === "dynamic_text_list" && Array.isArray(value)) {
                  const items = value.filter(val => val && String(val).trim() !== "");
                  if (items.length > 0) {
                      const listOpen = (field.listType && field.listType !== "" && field.listType !== "none") ? `[list=${field.listType}]` : "[list]";
                      replacement = field.listType === "none" ? items.join("\n") : `${listOpen}\n[*]${items.join("\n[*]")}\n[/list]`;
                  } else replacement = "";
              }
              else if (["dateTime", "pronouncedTimeOfDeath"].includes(field.name)) replacement = String(value).split("T")[0] || String(value);
              else if (field.name === "formattedDateOfDeath") replacement = formatToMMM_DD_YYYY(value);
              else if (field.name === "caseNumber") {
                  const url = String(value).trim();
                  const caseId = parseCaseNumber(url);
                  replacement = (url.startsWith('http') && caseId) ? `[url=${url}]${caseId}[/url]` : (caseId || url);
              }
          }        
          bbcode = bbcode.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), replacement);
      });

      bbcode = bbcode.replace(/{{(.+?)}}/g, (match, expr) => {
        const trimmed = expr.trim();
        if (trimmed.includes(":") && !/[+\-*/()=?<>!&|]/g.test(trimmed)) return trimmed;
        try {
          const fn = new Function('ctx', 'getDepartmentFullName', 'agencyDataStore', 'generateDecedentBBCode', `with (ctx) { return ${trimmed}; }`);
          const result = fn(ctx, getDepartmentFullName, agencyDataStore, generateDecedentBBCode);
          if (typeof result === 'object' && result !== null && Object.prototype.hasOwnProperty.call(result, 'confirmedAt')) return String(result.confirmedAt);
          return Array.isArray(result) ? result.join(", ") : String(result || "");
        } catch (e) { return ""; }
      });

      const isCoronerEmailFinal = selectedForm.name === "Coroner Email" || selectedForm.id === "coroner_email";
      if (isCoronerEmailFinal && (bbcode.includes('[bold]') || bbcode.includes('[/bold]'))) {
          bbcode = bbcode.replace(/\[bold\]/gi, '[b]').replace(/\[\/bold\]/gi, '[/b]');
      }

      return { bbcode, finalTitle };
    };

    const firstPass = performGeneration();
    let finalBBCode = firstPass.bbcode;
    const finalTitle = firstPass.finalTitle;

    /* 
    // PHPBB character limit and splitting logic (Commented out for later refinement)
    const PHPBB_LIMIT = 60000;
    const isMassFatality = selectedForm.firebaseKey === 'mass-ftality-test' || selectedForm.id === 'mass-fatality' || selectedForm.name?.toLowerCase().includes('mass fatality');

    if (finalBBCode.length > PHPBB_LIMIT) {
        if (isMassFatality && Array.isArray(formValues.decedents) && formValues.decedents.length > 1) {
            setLimitWarning("PHPBB Limit Hit: Report is over 60k characters. It has been automatically split into multiple parts.");
            const chunkSize = 5;
            const chunks = [];
            for (let i = 0; i < formValues.decedents.length; i += chunkSize) {
                chunks.push(formValues.decedents.slice(i, i + chunkSize));
            }
            finalBBCode = chunks.map((chunk, idx) => {
                const res = performGeneration(chunk);
                return `[CENTER][B]PART ${idx + 1} / ${chunks.length}[/B][/CENTER]\n${res.bbcode}`;
            });
        } else {
            setLimitWarning("PHPBB Limit Hit: This report is over 60k characters and may be truncated by the forum.");
        }
    } else {
        setLimitWarning("");
    }
    */

    setShowBBCode(true);
    setGeneratedBBCode(finalBBCode);
    setGeneratedTitle(finalTitle);
  }, [selectedForm, formValues, finalSelectOptions, agencyDataStore, gtaWorldUser]);

  return {
    generatedBBCode,
    generatedTitle,
    showBBCode,
    setShowBBCode,
    generateBBCode,
    // limitWarning
  };
};


export default useBbcodeGenerator;