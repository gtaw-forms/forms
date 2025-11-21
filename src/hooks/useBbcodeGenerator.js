import { useState, useCallback } from 'react';
import { getUtcFormattedDateTime, getUtcFormattedTime } from '../utils/dateTimeUtils'; // Assuming these are needed
import { getDepartmentFullName } from '../utils/bbcodeHelpers'; // Import the helper

const useBbcodeGenerator = (selectedForm, formValues, finalSelectOptions, agencyDataStore) => { // Accept agencyDataStore
  const [generatedBBCode, setGeneratedBBCode] = useState("");
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [showBBCode, setShowBBCode] = useState(false);

  const generateBBCode = useCallback(() => {
    if (!selectedForm?.template) return;

    let bbcode = selectedForm.template; // Initial template string
    let title = "";

    // Generate title if titleGeneratorCode exists
    if (selectedForm.titleGeneratorCode) {
      try {
        const funcString = selectedForm.titleGeneratorCode;
        const arrowIndex = funcString.indexOf('=>');

        if (arrowIndex !== -1) {
          const paramsString = funcString.substring(0, arrowIndex).trim();
          const bodyString = funcString.substring(arrowIndex + 2).trim();

          const params = (paramsString.startsWith('(') && paramsString.endsWith(')'))
                         ? paramsString.substring(1, paramsString.length - 1).trim()
                         : paramsString.trim();

          const firstBacktickIndex = bodyString.indexOf('`');
          const lastBacktickIndex = bodyString.lastIndexOf('`');

          let actualBodyContent = bodyString;
          if (firstBacktickIndex !== -1 && lastBacktickIndex !== -1 && firstBacktickIndex < lastBacktickIndex) {
              actualBodyContent = bodyString.substring(firstBacktickIndex + 1, lastBacktickIndex);
          } else {
              console.warn("titleGeneratorCode body might not be a template literal or is malformed when using arrow function syntax:", bodyString);
          }

          const titleFn = new Function(params, `return ${actualBodyContent}`);
          title = titleFn(formValues);

        } else {
          // If it's not an arrow function, assume it's just the template literal content
          // and wrap it in a function, replacing [FORM_NAME]
          let processedFuncString = funcString.replace(/\n\[FORM_NAME\]\n/g, selectedForm.name || '');
          try {
              const titleFn = new Function('formData', `return ${processedFuncString}`);
              title = titleFn(formValues);
          } catch (fnError) {
              console.error("Error generating title from plain template string:", fnError);
              title = `Error processing title template: ${fnError.message}`;
          }
        }
      } catch (error) {
        console.error("Error generating title with new Function():", error);
        title = `Error generating title: ${error.message}`;
      }
    } else {
      title = selectedForm.name || "Untitled Report";
    }
    setGeneratedTitle(title); // Set the generated title

    // Initialize processedBbcode with the selectedForm.template
    let processedBbcode = selectedForm.template;

    // --- Pass 1: Replace {{fieldName}} placeholders ---
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

    // --- Pass 2: Evaluate {{JavaScript Expressions}} ---
    const expressionPlaceholderRegex = /{{(.+?)}}/g; // Matches {{any_expression}}

    processedBbcode = processedBbcode.replace(expressionPlaceholderRegex, (match, expression) => {
        try {
            // Create a function to evaluate the extracted JavaScript expression
            // Provide helper functions and formData in the scope
            const evalFn = new Function(
                'formData',
                'getDepartmentFullName',
                'agencyDataStore',
                `return ${expression};` // Execute the extracted expression
            );
            // Execute the function with the current context
            const result = evalFn(formValues, getDepartmentFullName, agencyDataStore);
            return result !== undefined && result !== null ? String(result) : '';
        } catch (error) {
            console.warn(`useBbcodeGenerator: Error evaluating expression "${expression}":`, error);
            return `[ERROR: ${error.message}]`; // Return an error message in the BBCode
        }
    });

    setGeneratedBBCode(processedBbcode);
    setShowBBCode(true);
  }, [selectedForm, formValues, agencyDataStore]); // Added agencyDataStore to dependencies

  return { generatedBBCode, generatedTitle, showBBCode, setShowBBCode, generateBBCode };
};

export default useBbcodeGenerator;
