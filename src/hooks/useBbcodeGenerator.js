import { useState, useCallback } from 'react';
import { getUtcFormattedDateTime, getUtcFormattedTime } from '../utils/dateTimeUtils'; // Assuming these are needed
import { getDepartmentFullName } from '../utils/bbcodeHelpers'; // Import the helper

const useBbcodeGenerator = (selectedForm, formValues, finalSelectOptions, agencyDataStore) => { // Accept agencyDataStore
  const [generatedBBCode, setGeneratedBBCode] = useState("");
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [showBBCode, setShowBBCode] = useState(false);

  const generateBBCode = useCallback(() => {
    if (!selectedForm?.template) return;

    console.log("--- BBCode Generation Triggered ---");
    console.log("Form Values at generation time:", formValues);
    console.log("BBCode BEFORE generation:", generatedBBCode);

    let bbcode = selectedForm.template; // Initial template string
    let title = "";

    // Generate title if titleGeneratorCode exists
    if (selectedForm.titleGeneratorCode) {
      let titleTemplate = selectedForm.titleGeneratorCode;

      // 1. Replace [FORM_NAME]
      titleTemplate = titleTemplate.replace(/\[FORM_NAME\]/g, selectedForm.name || '');

      // 2. Replace {{variable}} placeholders
      const expressionPlaceholderRegex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
      titleTemplate = titleTemplate.replace(expressionPlaceholderRegex, (match, variableName) => {
          // Fallback to the original match (e.g., "{{PatientName}}") if value is not found
          return formValues[variableName] !== undefined ? formValues[variableName] : match;
      });

      title = titleTemplate;
    } else {
      title = selectedForm.name || "Untitled Report";
    }
    setGeneratedTitle(title); // Set the generated title

        // Initialize processedBbcode with the selectedForm.template

        let processedBbcode = selectedForm.template;

    

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

                let valToCompare = expectedValue;

                if (expectedValue.toLowerCase() === 'true') valToCompare = true;

                if (expectedValue.toLowerCase() === 'false') valToCompare = false;

                conditionMet = actualValue == valToCompare;

            } else {

                // No value attribute, check for truthiness (exists and is not an empty string)

                conditionMet = !!actualValue && actualValue !== "";

            }

    

            return conditionMet ? content : '';

        });

    

        // --- Pass 2: Replace {{fieldName}} placeholders ---

        selectedForm.fields?.forEach(field => {

          // Regex to find {{fieldName}} - ensuring it doesn't accidentally match something else

          const placeholderRegex = new RegExp(`{{\\s*${field.name}\\s*}}`, "g");

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

              const imageUrls = replacementValue.split(',').map(url => url.trim()).filter(url => url);

              replacementValue = imageUrls.map(url => `[img]${url}[/img]`).join('\n'); // Join with newline for multiple images

            } else {

              replacementValue = "[No images]";

            }

          } else if (field.type === "checkbox") {

            replacementValue = replacementValue ? "Yes" : "No";

          }

          // Apply replacement

          processedBbcode = processedBbcode.replace(placeholderRegex, replacementValue);

        });

    

        // --- Pass 3: Evaluate {{JavaScript Expressions}} ---

        const expressionPlaceholderRegex = /{{(.+?)}}/g; // Matches {{any_expression}}

    

        processedBbcode = processedBbcode.replace(expressionPlaceholderRegex, (match, expression) => {

            try {

                // Using 'with' statement for sandboxed evaluation.

                // This allows template expressions to directly access formValues properties.

                const evalFn = new Function(

                    'formData',

                    'getDepartmentFullName',

                    'agencyDataStore',

                    `with (formData) { return ${expression}; }`

                );

                const result = evalFn(formValues, getDepartmentFullName, agencyDataStore);

                return result !== undefined && result !== null ? String(result) : '';

            } catch (error) {

                console.warn(`useBbcodeGenerator: Error evaluating expression "${expression}":`, error);

                return `[ERROR: ${error.message}]`; // Return an error message in the BBCode

            }

        });

    

        console.log("BBCode AFTER generation:", processedBbcode);

        setGeneratedBBCode(processedBbcode);

        setShowBBCode(true);  }, [selectedForm, formValues, agencyDataStore]); // Added agencyDataStore to dependencies

  return { generatedBBCode, generatedTitle, showBBCode, setShowBBCode, generateBBCode };
};

export default useBbcodeGenerator;
