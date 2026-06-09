import React, { useCallback, useMemo, useState, useEffect } from 'react';
import ImageUploader from './ImageUploader'; // Assuming ImageUploader is in the same directory
import { getUtcFormattedDateTime, getUtcFormattedTime } from '../../utils/dateTimeUtils';

const inputStyle = { width: "100%", padding: "0.8rem", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8 };
const inputDisabledStyle = { width: "100%", padding: "0.8rem", background: "#0f172a", border: "1px solid #1e293b", color: "#475569", borderRadius: 8, cursor: "not-allowed" };
const labelStyle = { display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#94a3b8" };

const DecedentItemRenderer = ({
  itemValues,
  itemSchema,
  onItemChange,
  onRemove,
  index, // Index of the current decedent item in the list
  parentFieldName,
  finalSelectOptions, // Passed from FormHandler
  currentUtcTime,     // Passed from FormHandler
  agencyDataStore,    // Passed from FormHandler
  showNotification,    // Passed from FormHandler
  setShowMapModal,
  setMapTargetField,
  isUploadingMapImage = {},
}) => {
  if (!itemValues) {
    return null;
  }

  const handleSubFieldChange = useCallback((subFieldName, value) => {
    onItemChange(subFieldName, value);
  }, [onItemChange]);

  // Render each sub-field according to its type
  const renderSubField = useCallback((subField, idx) => {
        const fieldName = subField.name;

        if (subField.type === 'section') {
            return (
                <div key={idx} style={{ 
                    flexBasis: "100%", 
                    marginTop: idx === 0 ? "0" : "1.5rem", 
                    marginBottom: "0.8rem",
                    borderBottom: "1px solid #334155",
                    paddingBottom: "0.4rem"
                }}>
                    <h6 style={{ 
                        color: "#3b82f6", 
                        margin: 0, 
                        fontSize: "0.9rem", 
                        textTransform: "uppercase", 
                        letterSpacing: "0.05rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                    }}>
                        {subField.label === 'Identification' && <i className="fas fa-id-card"></i>}
                        {subField.label === 'Medical Findings' && <i className="fas fa-notes-medical"></i>}
                        {subField.label === 'Scene Evidence' && <i className="fas fa-camera"></i>}
                        {subField.label}
                    </h6>
                </div>
            );
        }

        const displayValue = itemValues[`${fieldName}_display`] || itemValues[fieldName] || '';
        const isFromMap = itemValues[`${fieldName}_isFromMap`];

        const commonProps = {
            name: fieldName,
            value: displayValue,
            onChange: (e) => onItemChange(fieldName, e.target.value),
            placeholder: subField.placeholder || '',
            style: inputStyle,
            rows: subField.rows,
            'data-parent-field': parentFieldName,
            'data-index': index,
        };

        let flexBasisValue = '100%';
        if (subField.layout === 'compact-50' || subField.layout === 'compact') {
            flexBasisValue = 'calc(50% - 0.4rem)';
        } else if (subField.layout === 'compact-33') {
            flexBasisValue = 'calc(33.333% - 0.533rem)';
        }

        return (
            <div key={subField.name || idx} style={{ flexBasis: flexBasisValue, marginBottom: "0.8rem", boxSizing: "border-box" }}>
                <label style={labelStyle}>{subField.label}</label>
                {isFromMap && (
                    <div style={{ fontSize: '0.75rem', color: '#34d399', marginBottom: '0.4rem', fontWeight: 'bold' }}>
                        <i className="fas fa-check-circle"></i> LINKED TO MAP
                    </div>
                )}
                {(() => {
                    const isPK = itemValues.typeOfDeath === 'PK';
                    if (subField.name === 'decedentName' && isPK) {
                        const isMale = itemValues.decedentName === 'John Doe';
                        const isFemale = itemValues.decedentName === 'Jane Doe';
                        return (
                            <div>
                                <input type="text" {...commonProps} value={itemValues.decedentName || 'John Doe'} disabled style={inputDisabledStyle} />
                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                    <button type="button" onClick={() => onItemChange('decedentName', 'John Doe')} style={{ flex: 1, padding: '0.6rem', background: isMale ? '#3b82f6' : '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                        ♂ Male
                                    </button>
                                    <button type="button" onClick={() => onItemChange('decedentName', 'Jane Doe')} style={{ flex: 1, padding: '0.6rem', background: isFemale ? '#3b82f6' : '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                        ♀ Female
                                    </button>
                                </div>
                            </div>
                        );
                    }
                    switch (subField.type) {
                        case 'text':
                            return <input type="text" {...commonProps} />;
                        case 'textarea':
                            return (
                                <>
                                    <textarea
                                        rows={subField.rows || 3}
                                        {...commonProps}
                                        style={{ ...commonProps.style, height: subField.rows ? `${subField.rows * 1.5}rem` : 'auto' }}
                                    />
                                    {subField.allowImagePaste && (
                                        <div style={{
                                            marginTop: "0.5rem",
                                            padding: "0.6rem",
                                            background: "#162032",
                                            borderRadius: 6,
                                            fontSize: "0.85rem",
                                            color: "#94a3b8",
                                            borderLeft: "3px solid #3b82f6"
                                        }}>
                                            <strong>Pro tip:</strong> Paste screenshots directly with <strong>Ctrl+V</strong>
                                        </div>
                                    )}
                                </>
                            );
                        case 'image':
                            return (
                                <ImageUploader
                                    images={itemValues[subField.name] || []}
                                    onImagesChange={(newImages) => handleSubFieldChange(subField.name, newImages)}
                                    notes={itemValues[`${subField.name}_narrative`] || ""}
                                    onNotesChange={(newNotes) => handleSubFieldChange(`${subField.name}_narrative`, newNotes)}
                                    maxImages={subField.maxImages || 6}
                                    fieldName={subField.name}
                                />
                            );
                        case 'select': {
                            const optionsToRender = finalSelectOptions[subField.optionsKey] || [];
                            return (
                                <select {...commonProps}>
                                    <option value="">— Select —</option>
                                    {optionsToRender.map((opt, optIndex) => {
                                        const value = typeof opt === 'object' && opt !== null ? opt.value : opt;
                                        const label = typeof opt === 'object' && opt !== null ? opt.label : opt;
                                        return <option key={`${value}-${optIndex}`} value={value}>{label}</option>
                                    })}
                                </select>
                            );
                        }
                        default:
                            return <input type="text" {...commonProps} />;
                    }
                })()}
            </div>
        );
    }, [itemValues, onItemChange, finalSelectOptions, index, parentFieldName, handleSubFieldChange]);

  const decedentName = itemValues.decedentName || '';
  const decedentOOC = itemValues.decedentOOC || '';

  const dynamicTitle = (decedentName && decedentOOC) 
    ? `${decedentName} - ${decedentOOC}` 
    : (decedentName || decedentOOC || 'Decedent Details');

  return (
    <div style={{ 
        border: "1px solid #334155", 
        padding: "1.5rem", 
        borderRadius: "0 0 8px 8px", 
        background: "#162032",
        borderTop: "none"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h5 style={{ color: "#f8fafc", margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
            <i className="fas fa-user-ghost" style={{ color: "#94a3b8" }}></i>
            {dynamicTitle}
        </h5>
        <button 
            onClick={onRemove} 
            className="btn btn-sm btn-danger"
            style={{ borderRadius: 6, padding: "0.4rem 1rem" }}
        >
            <i className="fas fa-trash-alt"></i> Remove Decedent
        </button>
      </div>

      <div style={{ padding: '10px 14px', background: '#1e1a0e', border: '1px solid #a3843b', borderRadius: 8, marginBottom: '1rem', fontSize: '0.82rem', color: '#e2d5a0', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <i className="fas fa-info-circle" style={{ color: '#e8c84a', marginTop: '2px', flexShrink: 0 }}></i>
        <span>PK decedents are considered <strong>John / Jane Doe</strong>. Selecting <strong>PK</strong> will lock the name field and let you choose between John and Jane.</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem" }}>
          {itemSchema.map((subField, idx) => renderSubField(subField, idx))}
      </div>
    </div>
  );
};

export default DecedentItemRenderer;