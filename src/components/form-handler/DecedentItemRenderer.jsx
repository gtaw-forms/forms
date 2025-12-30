import React, { useCallback, useMemo, useState } from 'react';
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
  showNotification,    // Passed from FormHandler
  setShowMapModal,
  setMapTargetField,
  isUploadingMapImage = {},
}) => {
    const [isMinimized, setIsMinimized] = useState(false); // New state for minimization
  const handleSubFieldChange = useCallback((subFieldName, value) => {
    onItemChange(subFieldName, value);
  }, [onItemChange]);

  // Render each sub-field according to its type
  const renderSubField = useCallback((subField, idx) => {
        const fieldName = subField.name;
        const isMapLocationField = fieldName === 'decedentLocation';
        const displayValue = itemValues[`${fieldName}_display`] || itemValues[fieldName] || '';
        const isFromMap = itemValues[`${fieldName}_isFromMap`];
        const targetFieldKey = `decedents.${index}.${fieldName}`; // Corrected targetFieldKey
        const isCurrentlyUploading = isUploadingMapImage[targetFieldKey];

        const commonProps = {
            name: fieldName,
            value: displayValue,
            onChange: (e) => onItemChange(fieldName, e.target.value),
            placeholder: subField.placeholder || '',
            style: inputStyle,
        };

        return (
            <div key={subField.name || idx} style={{ flexBasis: '100%', marginBottom: "0.8rem", boxSizing: "border-box" }}> {/* Use flexBasis here */}
                <label style={labelStyle}>{subField.label}</label>
                {isFromMap && (
                    <div style={{ fontSize: '0.75rem', color: '#34d399', marginBottom: '0.4rem' }}>
                        USING MAP MARKER
                    </div>
                )}
                {(() => { // IIFE to render the actual input field
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
                                    fieldName={subField.name}
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
                })()}
                <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                  {isMapLocationField && !isFromMap && !isCurrentlyUploading && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && (
                    <button
                      onClick={() => {
                        setMapTargetField(`decedents.${index}.decedentLocation`);
                        setShowMapModal(true);
                      }}
                      className="btn btn-sm btn-info"
                      style={{ flex: 1 }}
                    >
                      <i className="fas fa-map-marked-alt"></i> Map
                    </button>
                  )}
                  {isMapLocationField && isFromMap && (
                    <button
                      onClick={() => {
                        onItemChange(`${fieldName}_isFromMap`, false);
                        onItemChange(`${fieldName}_display`, '');
                        onItemChange(fieldName, itemValues[`${fieldName}_display`] || '');
                      }}
                      className="btn btn-sm btn-secondary"
                      style={{ flex: 1 }}
                    >
                      Use Manual Text
                    </button>
                  )}
                </div>
            </div>
        );
    }, [itemValues, onItemChange, finalSelectOptions, setShowMapModal, setMapTargetField, index]);

  const decedentName = itemValues.decedentName || '';
  const decedentOOC = itemValues.decedentOOC || '';

  let dynamicTitle = `Decedent #${index + 1}`;
  if (decedentName || decedentOOC) {
      dynamicTitle += `: ${decedentName}`;
      if (decedentOOC) {
          dynamicTitle += ` (${decedentOOC})`;
      }
  }

  return (
    <div style={{ border: "1px solid #334155", padding: "1rem", borderRadius: 8, marginBottom: "1rem", background: "#162032" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h5 style={{ color: "#e2e8f0", margin: 0 }}>{dynamicTitle}</h5>
        <div>
            <button
                onClick={() => setIsMinimized(!isMinimized)}
                style={{ background: "#6c757d", color: "white", border: "none", padding: "0.4rem 0.8rem", borderRadius: 6, cursor: "pointer", marginRight: "0.5rem" }}
            >
                {isMinimized ? 'Expand' : 'Minimize'}
            </button>
            <button onClick={onRemove} style={{ background: "#ef4444", color: "white", border: "none", padding: "0.4rem 0.8rem", borderRadius: 6, cursor: "pointer" }}>
                Remove
            </button>
        </div>
      </div>

      {!isMinimized && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem" }}> {/* New flex container for sub-fields */}
          {itemSchema.map((subField, idx) => {
            let flexBasisWidth = '100%';
            if (subField.layout === 'compact-50' || subField.layout === 'compact') { // Changed 'compact' to also be 50%
              flexBasisWidth = 'calc(50% - 0.4rem)'; // (100% - 1 * 0.8rem) / 2
            }
            // Pass the subField and its index to renderSubField
            return renderSubField(subField, idx);
          })}
        </div>
      )}
    </div>
  );
};

export default DecedentItemRenderer;