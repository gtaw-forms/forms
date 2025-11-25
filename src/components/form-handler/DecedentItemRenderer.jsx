import React, { useCallback, useMemo } from 'react';
import ImageUploader from './ImageUploader'; // Assuming ImageUploader is in the same directory
import { getUtcFormattedDateTime, getUtcFormattedTime } from '../../utils/dateTimeUtils';

const inputStyle = { width: "100%", padding: "0.8rem", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8 };
const labelStyle = { display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#94a3b8" };

const DecedentItemRenderer = ({
  itemValues,
  itemSchema,
  onItemChange,
  onRemove,
  index, // Index of the current decedent item in the list
  finalSelectOptions, // Passed from FormHandler
  currentUtcTime,     // Passed from FormHandler
  agencyDataStore,    // Passed from FormHandler
  showNotification    // Passed from FormHandler
}) => {
  const handleSubFieldChange = useCallback((subFieldName, value) => {
    onItemChange(subFieldName, value);
  }, [onItemChange]);

  // Render each sub-field according to its type
  const renderSubField = useCallback((subField) => {
    const commonProps = {
      name: subField.name,
      value: itemValues[subField.name] || '',
      onChange: (e) => handleSubFieldChange(subField.name, e.target.value),
      placeholder: subField.placeholder || '',
      style: inputStyle,
    };

    switch (subField.type) {
      case 'text':
        return <input type="text" {...commonProps} />;
      case 'textarea':
        return (
          <>
            <textarea
              rows={subField.rows || 3}
              {...commonProps}
            />
            {subField.allowImagePaste && (
              <div style={{
                marginTop: "0.5rem",
                padding: "0.6rem",
                background: "#162032",
                borderRadius: 6,
                fontSize: "0.85rem",
                color: "#94a3b8"
              }}>
                <strong>Pro tip:</strong> You can paste screenshots directly here with <strong>Ctrl+V</strong>
              </div>
            )}
          </>
        );
      case 'image':
        return (
          <ImageUploader
            images={itemValues[subField.name] || []}
            onImagesChange={(newImages) => handleSubFieldChange(subField.name, newImages)}
            maxImages={subField.maxImages || 6}
            fieldName={subField.name} // Pass fieldName for context if needed
          />
        );
      case 'select':
        const optionsToRender = finalSelectOptions[subField.optionsKey] || [];
        return (
          <select {...commonProps}>
            <option value="">— Select —</option>
            {optionsToRender.map((opt, optIndex) => {
              const value = typeof opt === 'object' && opt !== null ? opt.value : opt;
              const label = typeof opt === 'object' && opt !== null ? opt.label : opt;
              return <option key={`${value}-${optIndex}`} value={value}>{label}</option>;
            })}
          </select>
        );
      default:
        return <input type="text" {...commonProps} />;
    }
  }, [itemValues, handleSubFieldChange, finalSelectOptions]);

  return (
    <div style={{ border: "1px solid #334155", padding: "1rem", borderRadius: 8, marginBottom: "1rem", background: "#162032" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h5 style={{ color: "#e2e8f0", margin: 0 }}>Decedent #{index + 1}</h5>
        <button onClick={onRemove} style={{ background: "#ef4444", color: "white", border: "none", padding: "0.4rem 0.8rem", borderRadius: 6, cursor: "pointer" }}>
          Remove
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem" }}> {/* New flex container for sub-fields */}
        {itemSchema.map((subField, idx) => {
          let flexBasisWidth = '100%';
          if (subField.layout === 'compact-50' || subField.layout === 'compact') { // Changed 'compact' to also be 50%
            flexBasisWidth = 'calc(50% - 0.4rem)'; // (100% - 1 * 0.8rem) / 2
          }
          
          return (
            <div key={subField.name || idx} style={{ flexBasis: flexBasisWidth, marginBottom: "0.8rem", boxSizing: "border-box" }}>
              <label style={labelStyle}>{subField.label}</label>
              {renderSubField(subField)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DecedentItemRenderer;
