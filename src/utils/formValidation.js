/**
 * Validates a form definition against available select options.
 * @param {object} form - The form definition object.
 * @param {object} selectOptions - An object where keys are option groups.
 * @returns {string[]} A list of error messages.
 */
export const validateForm = (form, selectOptions) => {
  if (!form || !form.fields) {
    return ["Form definition is missing or has no fields."];
  }

  const errors = [];
  const availableOptionsKeys = Object.keys(selectOptions);

  form.fields.forEach(field => {
    // 1. Validate 'select' fields
    if (field.type === 'select' && field.optionsKey) {
      // First, check for a direct, case-sensitive match.
      if (!selectOptions[field.optionsKey]) {
        // If the direct match fails, try to find a case-insensitive match for a suggestion.
        const lowerCaseOptionsKey = field.optionsKey.toLowerCase();
        const suggestedKey = availableOptionsKeys.find(
          key => key.toLowerCase() === lowerCaseOptionsKey
        );

        let errorMessage = `Field "${field.label}" (name: ${field.name}) has an invalid optionsKey: "${field.optionsKey}".`;

        if (suggestedKey) {
          // A likely match was found, so we suggest it.
          errorMessage += ` Did you mean "${suggestedKey}"?`;
        } else {
          // No likely match was found.
          errorMessage += ` This key does not exist in the available selectOptions.`;
        }
        
        errors.push(errorMessage);
      }
    }

    // (Future validations can be added here)
  });

  return errors;
};

/**
 * Evaluates whether a field should be visible based on form values and its showIf conditions.
 * @param {object} field - The field definition.
 * @param {object} formValues - Current values of the form.
 * @returns {boolean}
 */
export const evaluateFieldVisibility = (field, formValues) => {
  if (!field.showIf) return true;

  const evaluateCondition = (cond) => {
    const current = formValues[cond.field];
    
    // Normalize expected value
    const expectedValue = (cond.value === "true") ? true : (cond.value === "false") ? false : cond.value;
    
    // Normalize current value
    let currentValue = current;
    if (typeof current === 'string') {
      if (current === "true") currentValue = true;
      else if (current === "false") currentValue = false;
    }

    let conditionMet = false;
    if (expectedValue === true) { // Has ANY value
      if (Array.isArray(currentValue)) conditionMet = currentValue.length > 0;
      else conditionMet = !!currentValue && currentValue !== "";
    } else if (expectedValue === false) { // Is empty
      if (Array.isArray(currentValue)) conditionMet = currentValue.length === 0;
      else conditionMet = !currentValue || currentValue === "";
    } else { // Exact value
      if (Array.isArray(currentValue)) {
        conditionMet = currentValue.includes(expectedValue);
      } else if (currentValue === true && ['yes', 'true', 'on'].includes(String(expectedValue).toLowerCase())) {
        conditionMet = true; 
      } else if (currentValue === false && ['no', 'false', 'off'].includes(String(expectedValue).toLowerCase())) {
        conditionMet = true; 
      } else {
        conditionMet = currentValue === expectedValue;
      }
    }
    return conditionMet;
  };

  if (field.showIf.mode === "and" || field.showIf.mode === "or") {
    const conditions = field.showIf.conditions || [];
    const results = conditions.map(evaluateCondition);
    return field.showIf.mode === "and" ? results.every(r => r) : results.some(r => r);
  } else {
    return evaluateCondition(field.showIf);
  }
};
