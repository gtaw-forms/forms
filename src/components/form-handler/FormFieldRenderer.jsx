import React, { useCallback } from 'react';
import ImageUploader from './ImageUploader'; // Assuming ImageUploader is in the same directory or adjust path
import { getUtcFormattedDateTime, getUtcFormattedTime } from '../../utils/dateTimeUtils';

const FormFieldRenderer = ({ field, formValues, handleChange, finalSelectOptions, currentUtcTime, agencyDataStore }) => {
  // Conditional visibility logic
  if (field.showIf) {
    let shouldShow = false;

    if (field.showIf.mode === "and" || field.showIf.mode === "or") {
      const conditions = field.showIf.conditions || [];
      const results = conditions.map(cond => {
        const current = formValues[cond.field];
        if (cond.value === true) return !!current && current !== "";
        if (cond.value === false) return !current || current === "";
        return current === cond.value;
      });

      shouldShow = field.showIf.mode === "and"
        ? results.every(r => r)
        : results.some(r => r);
    } else if (field.showIf.conditions) {
      // Backwards compatibility
      shouldShow = field.showIf.conditions.every(cond => {
        const current = formValues[cond.field];
        if (cond.value === true) return !!current;
        if (cond.value === false) return !current;
        return current === cond.value;
      });
    } else {
      // Simple mode
      const current = formValues[field.showIf.field];
      if (field.showIf.value === true) shouldShow = !!current && current !== "";
      else if (field.showIf.value === false) shouldShow = !current || current === "";
      else shouldShow = current === field.showIf.value;
    }

    if (!shouldShow) return null;
  }

  // Common styling wrapper for most fields
  const fieldWrapperStyle = {
    margin: "0 8px 1.5rem",
    width: field.layout === "full" ? "calc(100% - 16px)" : field.layout === "compact-50" ? "calc(50% - 16px)" : "calc(20% - 16px)",
    verticalAlign: "top",
    boxSizing: "border-box",
    display: "inline-block" // Ensure compact fields can sit next to each other
  };

  const inputStyle = { width: "100%", padding: "0.8rem", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8 };
  const labelStyle = { display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#94a3b8" };

  switch (field.type) {
    case "hr":
      return (
        <div style={{ margin: "0 8px 1.5rem", width: "calc(100% - 16px)", boxSizing: "border-box" }}>
          <hr style={{ borderTop: "1px solid #334155", margin: "1rem 0" }} />
        </div>
      );
    case "fake_line":
      return (
        <div style={{ margin: "0 8px 1.5rem", width: "calc(100% - 16px)", boxSizing: "border-box" }}>
          <hr style={{ borderTop: "1px dashed #334155", margin: "0", height: "1px" }} />
        </div>
      );
    case "small_header":
      return (
        <div style={{ margin: "0 8px 1.5rem", width: "calc(100% - 16px)", boxSizing: "border-box" }}>
          <h4 style={{ color: "#a78bfa", marginBottom: "1rem", marginTop: "1rem" }}>
            {field.label}
          </h4>
        </div>
      );
    case "timer":
      return (
        <div style={{...fieldWrapperStyle }}>
          <div style={{ display: "flex", flexDirection: "column", marginBottom: "5px" }}> {/* Stacks label and span */}
            <label style={labelStyle}>{field.label}</label>
            {field.displayCurrentTime && (
              <span style={{ fontSize: '0.8em', color: '#6c757d' }}> {/* Removed display: block here, as flex-direction column handles it */}
                Current Server Time: {currentUtcTime}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}> {/* Input and Button are here */}
            <input
              type={field.timerType || 'text'}
              name={field.name}
              value={formValues[field.name] || ""}
              onChange={e => handleChange(field.name, e.target.value)}
              style={{ ...inputStyle, flexGrow: 1 }}
            />
            {field.buttonLabel && (
              <button
                onClick={() => {
                  if (field.buttonAction === "set_current_time") {
                    const timeValue = field.timerType === 'datetime-local' ? getUtcFormattedDateTime() : getUtcFormattedTime();
                    handleChange(field.name, timeValue);
                  }
                }}
                style={{
                  padding: "0.5rem 1rem",
                  background: "#6366f1",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: "0.9rem",
                  fontWeight: "600",
                  flexShrink: 0,
                  position: "relative", // Added
                  top: "-10px" // Added
                }}
              >
                {field.buttonLabel}
              </button>
            )}
          </div>
        </div>
      );
    case "select":
      let optionsToRender = [];
      let warningMessage = null;

      if (field.optionsKey === "agencies") {
        if (agencyDataStore) {
          optionsToRender = Object.values(agencyDataStore).map(agency => ({
            value: agency.shortCode, // Assuming shortCode is the key in agencyDataStore
            label: agency.fullName
          }));
        } else {
          warningMessage = `agencyDataStore not available for agencies options.`;
        }
      } else {
        const standardOptions = finalSelectOptions[field.optionsKey];
        if (standardOptions) {
          optionsToRender = Object.values(standardOptions);
        } else {
          warningMessage = `optionsKey "${field.optionsKey}" not found in finalSelectOptions.`;
        }
      }

      if (warningMessage) {
        console.warn(`FormFieldRenderer: ${warningMessage} For field "${field.name}".`);
      }

      return (
        <div style={{ ...fieldWrapperStyle, display: "inline-block" }}>
          <label style={labelStyle}>{field.label}</label>
            <select
              value={formValues[field.name] || ""}
              onChange={e => handleChange(field.name, e.target.value)}
              style={inputStyle}
            >
              <option value="">— Select —</option>
              {optionsToRender.length > 0 ? (
                optionsToRender.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))
              ) : (
                <option value="" disabled>{warningMessage || `No options found for "${field.optionsKey}"`}</option>
              )}
            </select>
        </div>
      );
    case "textarea":
      return (
        <div style={{ ...fieldWrapperStyle, display: "inline-block" }}>
          <label style={labelStyle}>{field.label}</label>
          <textarea
            rows={field.rows || 4}
            value={formValues[field.name] || ""}
            onChange={e => handleChange(field.name, e.target.value)}
            placeholder={field.placeholder || ""}
            style={inputStyle}
          />
        </div>
      );
    case "image":
      return (
        <div style={{ ...fieldWrapperStyle, display: "inline-block" }}>
          <label style={labelStyle}>{field.label}</label>
          <ImageUploader
            images={formValues[field.name] || []}
            onImagesChange={imgs => handleChange(field.name, imgs)}
            maxImages={field.maxImages || 6}
          />
        </div>
      );
    case "checkbox":
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            ...fieldWrapperStyle
          }}
        >
          <label style={{ display: "flex", alignItems: "center", cursor: "pointer", color: "#e2e8f0" }}>
            <input
              type="checkbox"
              checked={!!formValues[field.name]}
              onChange={e => handleChange(field.name, e.target.checked)}
              style={{ marginRight: "0.8rem" }}
            />
            {field.label}
          </label>
          {formValues[field.name] && field.associatedInputField && (
            <>
              {field.associatedInputField.type === "select" && finalSelectOptions[field.associatedInputField.optionsKey] ? (
                <select
                  value={formValues[field.associatedInputField.name] || ""}
                  onChange={e => handleChange(field.associatedInputField.name, e.target.value)}
                  style={inputStyle}
                >
                  <option value="">— Select —</option>
                  {Object.values(finalSelectOptions[field.associatedInputField.optionsKey]).map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : field.associatedInputField.type === "textarea" ? (
                <textarea
                  rows={field.associatedInputField.rows || 1}
                  value={formValues[field.associatedInputField.name] || ""}
                  onChange={e => handleChange(field.associatedInputField.name, e.target.value)}
                  placeholder={field.associatedInputField.placeholder || ""}
                  style={inputStyle}
                />
              ) : (
                <input
                  type={field.associatedInputField.type || 'text'}
                  name={field.associatedInputField.name}
                  value={formValues[field.associatedInputField.name] || ""}
                  onChange={e => handleChange(field.associatedInputField.name, e.target.value)}
                  placeholder={field.associatedInputField.placeholder || ""}
                  style={inputStyle}
                />
              )}
            </>
          )}
        </div>
      );
    case "radio":
      return (
        <div style={{ ...fieldWrapperStyle, display: "inline-block" }}>
          <label style={labelStyle}>{field.label}</label>
          <div style={{ display: (field.layout === "compact") ? "inline-flex" : "flex", flexWrap: (field.layout === "compact") ? "nowrap" : "wrap", gap: "10px" }}>
            {field.options.map(option => (
              <label key={option} style={{ display: "flex", alignItems: "center", cursor: "pointer", color: "#e2e8f0" }}>
                <input
                  type="radio"
                  name={field.name}
                  value={option}
                  checked={formValues[field.name] === option}
                  onChange={e => handleChange(field.name, e.target.value)}
                  style={{ marginRight: "0.5rem" }}
                />
                {option}
              </label>
            ))}
          </div>
        </div>
      );
    case "input_button_combo":
      return (
        <div
          style={{
            ...fieldWrapperStyle,
            display: "inline-flex",
            flexDirection: (field.layout === "compact") ? "row" : "column",
            alignItems: (field.layout === "compact") ? "center" : "stretch",
            gap: "6px"
          }}
        >
          <label style={{ ...labelStyle, flexShrink: 0 }}>
            {field.label}
          </label>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%' }}>
            <input
              type={field.inputType || 'text'}
              name={field.name}
              value={formValues[field.name] || ""}
              onChange={e => handleChange(field.name, e.target.value)}
              style={{ ...inputStyle, flexGrow: 1 }}
            />
            <button
              onClick={() => {
                if (field.buttonAction === "set_current_time") {
                  const timeValue = field.inputType === 'datetime-local' ? getUtcFormattedDateTime() : getUtcFormattedTime();
                  handleChange(field.name, timeValue);
                }
              }}
              style={{
                padding: "0.5rem 1rem",
                background: "#6366f1",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: "0.9rem",
                fontWeight: "600",
                flexShrink: 0
              }}
            >
              {field.buttonLabel}
            </button>
          </div>
        </div>
      );
    case "input":
    default:
      return (
        <div style={{ ...fieldWrapperStyle, display: "inline-block" }}>
          <label style={labelStyle}>{field.label}</label>
          <input
            type="text"
            value={formValues[field.name] || ""}
            onChange={e => handleChange(field.name, e.target.value)}
            placeholder={field.placeholder || ""}
            style={inputStyle}
          />
        </div>
      );
  }
};

export default FormFieldRenderer;
