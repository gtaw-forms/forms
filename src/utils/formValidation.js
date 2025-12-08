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
