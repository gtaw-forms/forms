import { useState, useCallback } from 'react';
import { getUtcFormattedDateTime, getUtcFormattedTime } from '../utils/dateTimeUtils'; // Assuming these are needed
import { getDepartmentFullName } from '../utils/bbcodeHelpers'; // Import the helper
import generateDecedentBBCode from '../phmc-bbcode-generators/generateMassFatality'; // Import the new function

const useBbcodeGenerator = (selectedForm, formValues, finalSelectOptions, agencyDataStore) => { // Accept agencyDataStore
  const [generatedBBCode, setGeneratedBBCode] = useState("");
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [showBBCode, setShowBBCode] = useState(false);

  const generateBBCode = useCallback(() => {
    if (!selectedForm?.template) return;

    console.log("--- BBCode Generation Triggered ---");
    console.log("Selected Form (including fields):", selectedForm); // Add this log
    console.log("Form Values at generation time:", formValues);
    // console.log("BBCode BEFORE generation:", generatedBBCode);

    let bbcode = selectedForm.template; // Initial template string
    let title = "";

    // Create an evaluation context that includes case-insensitive fallbacks for common fields
    const evaluationContext = { ...formValues };
    evaluationContext.formData = evaluationContext; // Add self-reference for expressions expecting it

    // Dynamically add case-insensitive fallbacks for common names like 'PatientName' or 'employeeName'
    // This will make 'PatientName' available even if the actual field is 'patientName'
    if (formValues.patientName !== undefined && evaluationContext.PatientName === undefined) {
        evaluationContext.PatientName = formValues.patientName;
    }
    if (formValues.PatientName !== undefined && evaluationContext.patientName === undefined) {
        evaluationContext.patientName = formValues.PatientName;
    }
    if (formValues.employeeName !== undefined && evaluationContext.EmployeeName === undefined) {
        evaluationContext.EmployeeName = formValues.employeeName;
    }
    if (formValues.EmployeeName !== undefined && evaluationContext.employeeName === undefined) {
        evaluationContext.employeeName = formValues.EmployeeName;
    }
    if (formValues.phmcEmployee !== undefined && evaluationContext.PHMCEmployee === undefined) {
        evaluationContext.PHMCEmployee = formValues.phmcEmployee;
    }
    if (formValues.PHMCEmployee !== undefined && evaluationContext.phmcEmployee === undefined) {
        evaluationContext.phmcEmployee = formValues.PHMCEmployee;
    }
    if (formValues.coronerEmployee !== undefined && evaluationContext.CoronerEmployee === undefined) {
        evaluationContext.CoronerEmployee = formValues.coronerEmployee;
    }
    if (formValues.CoronerEmployee !== undefined && evaluationContext.coronerEmployee === undefined) {
        evaluationContext.coronerEmployee = formValues.CoronerEmployee;
    }

// --- Special Title Generation for Coroner Email ---
if (selectedForm.name === "Coroner Email" || selectedForm.id === "coroner_email") {

  console.log("%c[Coroner Email Title Debug]", "color: #FFA500; font-weight: bold;", "Initiating special handling...");
  console.log("[Coroner Email Title Debug] Raw formValues.decedentName at start:", formValues.decedentName);
  console.log("[Coroner Email Title Debug] Raw formValues.attachedReportKeys at start:", formValues.attachedReportKeys);

  const uniqueDecedentNames = new Set();

  // 1. Add names from formValues.decedentName (can include manually entered names or previous attachments)
  if (formValues.decedentName) {
    console.log("[Coroner Email Title Debug] Processing formValues.decedentName...");
    const names = formValues.decedentName.split(', ').map(name => name.trim()).filter(name => name !== '');
    names.forEach(name => {
      uniqueDecedentNames.add(name);
      console.log(`[Coroner Email Title Debug] Added from formValues.decedentName: "${name}". Current unique names: ${Array.from(uniqueDecedentNames).join(', ')}`);
    });
  }

  // 2. Add names parsed from formValues.attachedReportKeys (explicitly attached reports)
  if (Array.isArray(formValues.attachedReportKeys)) {
    console.log("[Coroner Email Title Debug] Processing attachedReportKeys for names...");
    formValues.attachedReportKeys.forEach(originalKey => {
      let parsedName = null;
      if (originalKey.startsWith('[DEATH-REPORT]')) {
        const nameMatch = originalKey.match(/\[DEATH-REPORT\]\s*([^-]+)/);
        if (nameMatch && nameMatch[1]) {
          parsedName = nameMatch[1].trim();
        }
      } else if (originalKey.startsWith('[Autopsy]')) {
        const nameMatch = originalKey.match(/\[Autopsy\]\s*([^(]+)/);
        if (nameMatch && nameMatch[1]) {
          parsedName = nameMatch[1].trim();
        }
      }
      // Add more parsers for other report types if they need to contribute to the title

      if (parsedName) {
        uniqueDecedentNames.add(parsedName);
        console.log(`[Coroner Email Title Debug] Parsed from attached report "${originalKey}": "${parsedName}". Current unique names: ${Array.from(uniqueDecedentNames).join(', ')}`);
      } else {
        console.log(`[Coroner Email Title Debug] Could not parse name from attached report "${originalKey}".`);
      }
    });
  }

  console.log("[Coroner Email Title Debug] Calculating final title from aggregated names...");
  const decedentDisplay = uniqueDecedentNames.size > 0
    ? Array.from(uniqueDecedentNames).sort().join(', ') // Sort for consistent order
    : "Unknown Decedent";

  console.log("[Coroner Email Title Debug] Final aggregated names (decedentDisplay):", decedentDisplay);

  title = `[Coroner Email] ${decedentDisplay}`;
  console.log("%c[CORONER EMAIL] FINAL TITLE:", "color: #00ff00; font-weight: bold;", title);

  setGeneratedTitle(title);

  // Skip normal title generation
  // Do NOT fall through to titleGeneratorCode
} else if (selectedForm.name === 'Mass Fatality Form') {
  console.log("%c[Mass Fatality Title Debug]", "color: #00A5FF; font-weight: bold;", "Initiating special handling...");
  
  let decedentNames = [];
  if (Array.isArray(formValues.decedents) && formValues.decedents.length > 0) {
    decedentNames = formValues.decedents
      .map(d => d.decedentName)
      .filter(Boolean); // Filter out any undefined/null/empty names
  }

  const namesString = decedentNames.length > 0 ? decedentNames.join(', ') : 'No Decedents';
  console.log("[Mass Fatality Title Debug] Aggregated names:", namesString);

  // --- ADDED DATE LOGIC ---
  let formattedDate = '';
  if (formValues.dateTime || formValues.date) {
      let dateValue = formValues.dateTime || formValues.date;
      if (typeof dateValue === 'string') {
          // First, strip time if it's an ISO date string
          if (dateValue.includes('T')) {
              dateValue = dateValue.split('T')[0]; // YYYY-MM-DD
          }
          
          // Now, reformat to MM/DD/YYYY
          try {
              const dateObj = new Date(dateValue);
              if (!isNaN(dateObj.getTime())) {
                  formattedDate = dateObj.toLocaleDateString('en-US'); // MM/DD/YYYY
              }
          } catch (e) {
              console.error("Error formatting date for Mass Fatality title:", e);
          }
      }
  }
  // --- END ADDED DATE LOGIC ---

  title = `[Mass Fatality] ${namesString}${formattedDate ? ` - ${formattedDate}` : ''}`;
  console.log("%c[Mass Fatality] FINAL TITLE:", "color: #00ff00; font-weight: bold;", title);

  setGeneratedTitle(title);
} 
// Normal title generation for all other forms
else if (selectedForm.titleGeneratorCode) {
  try {
    let titleTemplate = selectedForm.titleGeneratorCode;
    
    // Normalize date/dateTime for the template.
    // This allows templates to always use {{date}} and the logic will find the correct value.
    if (evaluationContext.dateTime || evaluationContext.date) {
        let dateValue = evaluationContext.dateTime || evaluationContext.date;
        let formattedDate = dateValue; // Initialize with original value

        if (typeof dateValue === 'string') {
            // First, strip time if it's an ISO date string
            if (dateValue.includes('T')) {
                formattedDate = dateValue.split('T')[0]; // YYYY-MM-DD
            }
            
            // Now, reformat to MM/DD/YYYY
            try {
                const dateObj = new Date(formattedDate);
                if (!isNaN(dateObj.getTime())) {
                    formattedDate = dateObj.toLocaleDateString('en-US'); // MM/DD/YYYY
                }
                // If date is invalid, formattedDate remains YYYY-MM-DD or original
            } catch (e) {
                console.error("Error formatting date for title:", e);
                // formattedDate remains YYYY-MM-DD or original on error
            }
        }
        evaluationContext.date = formattedDate; // Assign the processed date
    }

    // Replace {{key}} placeholders from evaluationContext
    for (const key in evaluationContext) {
      if (Object.prototype.hasOwnProperty.call(evaluationContext, key)) {
        const placeholderRegex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
        let replacementValue = evaluationContext[key] ?? "";

        if (Array.isArray(replacementValue)) {
            replacementValue = replacementValue.join(', ');
        }
        
        titleTemplate = titleTemplate.replace(placeholderRegex, replacementValue);
      }
    }

    // For safety, remove any placeholders that weren't replaced.
    title = titleTemplate.replace(/{{.+?}}/g, '').trim();

    setGeneratedTitle(title);
  } catch (error) {
    console.error("Error processing titleGeneratorCode as template:", error);
    title = `${selectedForm.name || "Untitled Report"} (Title Error)`;
    setGeneratedTitle(title);
  }
} else {
  title = selectedForm.name || "Untitled Report";
  setGeneratedTitle(title);
}       
    // Initialize processedBbcode with the selectedForm.template
        
            let processedBbcode = selectedForm.template;
        
            // Dynamically add case-insensitive fallbacks for common names like 'PatientName' or 'employeeName'
            // This will make 'PatientName' available even if the actual field is 'patientName'
            if (formValues.patientName !== undefined && evaluationContext.PatientName === undefined) {
                evaluationContext.PatientName = formValues.patientName;
            }
            if (formValues.PatientName !== undefined && evaluationContext.patientName === undefined) {
                evaluationContext.patientName = formValues.PatientName;
            }
            if (formValues.employeeName !== undefined && evaluationContext.EmployeeName === undefined) {
                evaluationContext.EmployeeName = formValues.employeeName;
            }
            if (formValues.EmployeeName !== undefined && evaluationContext.employeeName === undefined) {
                evaluationContext.employeeName = formValues.EmployeeName;
            }
            if (formValues.phmcEmployee !== undefined && evaluationContext.PHMCEmployee === undefined) {
                evaluationContext.PHMCEmployee = formValues.phmcEmployee;
            }
            if (formValues.PHMCEmployee !== undefined && evaluationContext.phmcEmployee === undefined) {
                evaluationContext.phmcEmployee = formValues.PHMCEmployee;
            }
            if (formValues.coronerEmployee !== undefined && evaluationContext.CoronerEmployee === undefined) {
                evaluationContext.CoronerEmployee = formValues.coronerEmployee;
            }
            if (formValues.CoronerEmployee !== undefined && evaluationContext.coronerEmployee === undefined) {
                evaluationContext.coronerEmployee = formValues.CoronerEmployee;
            }

            // --- Handle Decedent List BBCode Generation ---
            let generatedDecedentsBbcode = '';
            const decedentsField = selectedForm.fields?.find(f => f.name === 'decedents' && f.type === 'decedent_list');
            if (decedentsField && Array.isArray(formValues.decedents) && formValues.decedents.length > 0) {
                generatedDecedentsBbcode = generateDecedentBBCode(formValues.decedents, {
                    coronerRank: formValues.coronerRank,
                    coronerEmployee: formValues.coronerEmployee
                });
            }
            // Add the generated BBCode to the evaluation context for simple {{variable}} replacement
            evaluationContext.decedents_array_bbcode = generatedDecedentsBbcode;
        
            // NEW PASS: Convert {{cb:variable}} into [conditional] tags
            // This captures the text immediately following {{cb:variableName}} up to a newline, { or [
            processedBbcode = processedBbcode.replace(
                /{{cb:([a-zA-Z0-9_]+)}}\s*([^\n\r{[]*)/g,
                (match, variableName, content) => {
                    return `[conditional field="${variableName}" value="true"]${content.trim()}[/conditional]`;
                }
            );

            // --- Pass 1: Evaluate [conditional] blocks ---
        const conditionalRegex = /\[conditional\s+([^\]]+)\]([\s\S]*?)\[\/conditional\]/g;

        processedBbcode = processedBbcode.replace(conditionalRegex, (match, attrs, content) => {

            const fieldMatch = /field="([^"]+)"/.exec(attrs);

            const valueMatch = /value="([^"]+)"/.exec(attrs);

    

            if (!fieldMatch) {

                return `[INVALID CONDITIONAL ATTRIBUTES: ${attrs}]`;

            }

    

            const fieldName = fieldMatch[1];

            const expectedValue = valueMatch ? valueMatch[1] : undefined;

            const actualValue = formValues[fieldName];

    

            let conditionMet = false;

            if (expectedValue !== undefined) {
                let valToCompare = expectedValue; // Initialize with expectedValue
                if (typeof expectedValue === 'string') { // Only apply to string values
                    if (expectedValue.toLowerCase() === 'true') valToCompare = true;
                    if (expectedValue.toLowerCase() === 'false') valToCompare = false;
                }
                conditionMet = actualValue == valToCompare;
            } else {
                // No value attribute, check for truthiness (exists and is not an empty string)
                conditionMet = !!actualValue && actualValue !== "";
            }

    

                        return conditionMet ? content : '';

    

                    }); 



// --- Pass 1.6: Evaluate inline [cb:fieldName] OptionText tags ---
// Matches [cb:fieldName] followed by optional space and then the option text
// ([^[\r\n]+?) captures the option text non-greedily until the next '[' or newline/end.
// Your current working regex (just make sure it has \s*)
console.log('%c[CB DEBUG] Starting [cb:] processing pass...', 'color: cyan; font-weight: bold;');

processedBbcode = processedBbcode.replace(
  /\[cb:([a-zA-Z0-9_]+)(?:=([^\]]+))?\]\s*([^[\n\r]*)/g,
  (match, fieldName, expectedValue, text) => {
    const actual = String(formValues[fieldName] || '').trim();
    const option = text.trim();

    const isMatch = expectedValue 
      ? actual === expectedValue.trim()
      : actual === option;

    return isMatch ? `[cbc] ${option}` : `[cb] ${option}`;
  }
);
console.log('%c[CB DEBUG] [cb:] processing complete.', 'color: cyan; font-weight: bold;');        


        // NEW PASS: Replace simple {{key}} placeholders directly from evaluationContext
        // This handles any key in formValues/evaluationContext as a direct placeholder
        for (const key in evaluationContext) {
            if (Object.prototype.hasOwnProperty.call(evaluationContext, key)) {
                const placeholderRegex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
                let replacementValue = evaluationContext[key] ?? "";

                if (Array.isArray(replacementValue)) {
                    replacementValue = replacementValue.join(', '); // Join array elements for display
                }
                
                processedBbcode = processedBbcode.replace(placeholderRegex, replacementValue);
            }
        }

        // Existing loop for selectedForm.fields - still needed for type-specific formatting
        selectedForm.fields?.forEach(field => {
          // Only process fields that might have specific BBCode formatting beyond simple value insertion
          // if a direct {{field.name}} placeholder is still present AND it has special type handling.
          const placeholderRegex = new RegExp(`{{\\s*${field.name}\\s*}}`, "g");
          // If the placeholder was already replaced by the general formValues pass, skip this.
          // This ensures field type logic only applies if the placeholder is explicitly for a field.
          if (!processedBbcode.match(placeholderRegex)) {
            return; 
          }

          let replacementValue = formValues[field.name] ?? ""; // Default to empty string

          // Handle specific field types for replacement logic
          if (field.type === "hr") {
            replacementValue = "\n[hr]\n";
          } else if (field.type === "fake_line") {
            replacementValue = "\n[hr][hr]\n"; // Represent fake line with double HR for BBCode
          } else if (field.type === "small_header") {
            replacementValue = `[size=10][b]${field.label}[/b][/size]`;
          } else if (field.type === "image") {
            if (replacementValue) { // If value exists (comma-separated URLs)
              const imageUrls = (Array.isArray(replacementValue) ? replacementValue : String(replacementValue).split(','))
                                .map(url => url.trim())
                                .filter(url => url);
              replacementValue = imageUrls.map(url => `[img]${url}[/img]`).join('\n'); // Join with newline for multiple images
            } else {
              replacementValue = "[No images]";
            }
          } else if (field.type === "checkbox") {
            replacementValue = replacementValue ? "Yes" : "No";
          } else if (field.type === "multi_select") {
            // Multi-select values are already handled by the generic formValues pass as a joined string
            // No specific BBCode formatting needed here unless there's a custom display for multi-select.
            // If it's still present, it means the earlier pass didn't catch it, which it should have.
            return; 
          }

          // Apply replacement (this will only replace if the placeholder is still present)
          processedBbcode = processedBbcode.replace(placeholderRegex, replacementValue);
        });
    

        // --- Pass 3: Evaluate remaining {{JavaScript Expressions}} ---
        const expressionPlaceholderRegex = /{{(.+?)}}/g; // Matches {{any_expression}}

        processedBbcode = processedBbcode.replace(expressionPlaceholderRegex, (match, expression) => {
            const trimmedExpression = expression.trim();

            // Heuristic check: If the expression contains a colon but no typical JS operators/property access,
            // or starts with a space, it's likely a literal string the user expects to be verbatim.
            // Modified to not treat [ and ] as problematic, as they are part of BBCode syntax.
            const seemsLikeLiteralOrPlainString = (trimmedExpression.includes(':') && !trimmedExpression.match(/[\.\(\)\+\-\*\/%&|\^~!=<>?]/)) 
                                                || trimmedExpression.startsWith(' ') 
                                                || !trimmedExpression.match(/[a-zA-Z0-9_.]/); // If it doesn't even look like a variable name/property

            if (seemsLikeLiteralOrPlainString) {
                // If it seems like a literal string or plain text, just return it as is.
                return trimmedExpression; 
            }

            try {
                const evalFn = new Function(
                    'context',
                    'getDepartmentFullName',
                    'agencyDataStore',
                    'generateDecedentBBCode',
                    `with (context) { return ${trimmedExpression}; }`
                );
                const result = evalFn(
                    evaluationContext,
                    getDepartmentFullName,
                    agencyDataStore,
                    generateDecedentBBCode
                );

                // Handle array results from JS expressions (e.g., if a JS expression returns an array)
                if (Array.isArray(result)) {
                  return result.join(', '); // Join array elements with comma and space
                }

                return result !== undefined && result !== null ? String(result) : '';
            } catch (error) {
                console.warn(`useBbcodeGenerator: Error evaluating expression "${trimmedExpression}":`, error);
                // If it fails, return an empty string to prevent the error message in the BBCode.
                return '';
            }
        });

    

        // console.log("BBCode AFTER generation:", processedBbcode);

        setGeneratedBBCode(processedBbcode);

        setShowBBCode(true);  }, [selectedForm, formValues, agencyDataStore]); // Added agencyDataStore to dependencies

  return { generatedBBCode, generatedTitle, showBBCode, setShowBBCode, generateBBCode };
};

export default useBbcodeGenerator;

