import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Select from 'react-select';
import ImageUploader from './ImageUploader'; // Assuming ImageUploader is in the same directory or adjust path
import { getUtcFormattedDateTime, getUtcFormattedTime } from '../../utils/dateTimeUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth'; // Import useGtaWorldAuth
import DecedentItemRenderer from './DecedentItemRenderer'; // Import the new component
import AutopsyDiagramModal from '../AutopsyDiagramModal'; // Import AutopsyDiagramModal
import CharacterSelector from '../CharacterSelector';

const FormFieldRenderer = ({ field, selectedForm, formValues, handleChange, finalSelectOptions, currentUtcTime, agencyDataStore, toggleSavedReports, showNotification, handleDiagramUpload }) => {
  const { factionsData } = useData();

  const employeeOptions = useMemo(() => {
    if (!factionsData || !factionsData['364'] || !factionsData['364'].members) return [];
    return Object.values(factionsData['364'].members)
        .map(member => ({
            value: member.characterName, // Use name as value
            label: member.characterName 
        }))
        .sort((a, b) => a.label.localeCompare(b.label)); // Sort alphabetically
  }, [factionsData]);

  // Conditional visibility logic
  if (field.showIf) {
    let shouldShow = false;
    const fieldName = field.label || field.name;
    //console.log(`[Conditional Check] Field: '${fieldName}'. Evaluating visibility...`);

    const evaluateCondition = (cond) => {
        const current = formValues[cond.field];
        const expectedValue = (cond.value === "true") ? true : (cond.value === "false") ? false : cond.value;
        const currentValue = (typeof current === 'string' && (current === "true" || current === "false")) ? (current === "true") : current;

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
            } else if (expectedValue === 'Yes' && currentValue === true) {
                conditionMet = true; // Fix for 'Yes' string matching boolean true
            } else {
                conditionMet = currentValue === expectedValue;
            }
        }
        
        const status = conditionMet ? 'PASSED' : 'INVALID';
        //console.log(`[Conditional Check]  - Condition for '${cond.field}': ${status}. Expected: '${expectedValue}', Found: '${currentValue}'`);
        return conditionMet;
    };

    if (field.showIf.mode === "and" || field.showIf.mode === "or") {
        const conditions = field.showIf.conditions || [];
        //console.log(`[Conditional Check]  - Mode: ${field.showIf.mode.toUpperCase()}, Conditions: ${conditions.length}`);
        const results = conditions.map(evaluateCondition);
        shouldShow = field.showIf.mode === "and" ? results.every(r => r) : results.some(r => r);
    } else {
        shouldShow = evaluateCondition(field.showIf);
    }

    if (!shouldShow) {
        //console.log(`[Conditional Check] Result for '${fieldName}': HIDDEN`);
        return null;
    }
    //console.log(`[Conditional Check] Result for '${fieldName}': VISIBLE`);
  }

  // Common styling wrapper for most fields
  const fieldWrapperStyle = {
    margin: "0 8px 1.5rem",
    width: field.layout === "full" ? "calc(100% - 16px)" : field.layout === "compact-50" ? "calc(50% - 16px)" : field.layout === "compact-33" ? "calc(33.333% - 16px)" : "calc(20% - 16px)",
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
    case "information_state": {
      const getInfoStyle = () => {
        const baseStyle = {
          padding: '1rem',
          borderRadius: '8px',
          color: '#e2e8f0',
          width: '100%',
          boxSizing: 'border-box',
          whiteSpace: 'pre-wrap', // To respect newlines and spaces
        };
        switch (field.infoType) {
          case 'Warning':
            return { ...baseStyle, backgroundColor: '#3d301a', border: '1px solid #f59e0b' };
          case 'Danger':
            return { ...baseStyle, backgroundColor: '#401f23', border: '1px solid #ef4444' };
          case 'Information':
          default:
            return { ...baseStyle, backgroundColor: '#1e293b', border: '1px solid #3b82f6' };
        }
      };

      return (
        <div style={fieldWrapperStyle}>
          <div style={getInfoStyle()}>
            {field.content}
          </div>
        </div>
      );
    }
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
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-start" }}> {/* Changed to column */}
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
                  // Removed: position: "relative", top: "-10px"
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
              onChange={(e) => handleChange(field.name, e.target.value)}
              style={inputStyle}
            >
              <option value="">— Select —</option>
              {optionsToRender.length > 0 ? (
                optionsToRender.map((opt, index) => {
                  const value = typeof opt === 'object' && opt !== null ? opt.value : opt;
                  const label = typeof opt === 'object' && opt !== null ? opt.label : opt;
                  return <option key={`${value}-${index}`} value={value}>{label}</option>;
                })
              ) : (
                <option value="" disabled>{warningMessage || `No options found for "${field.optionsKey}"`}</option>
              )}
            </select>
        </div>
      );
    case "multi_select":
      let multiSelectOptionsToRender = [];
      let multiSelectWarningMessage = null;

      if (field.optionsKey === "agencies") {
        if (agencyDataStore) {
          multiSelectOptionsToRender = Object.values(agencyDataStore).map(agency => ({
            value: agency.shortCode,
            label: agency.fullName
          }));
        } else {
          multiSelectWarningMessage = `agencyDataStore not available for agencies options.`;
        }
      } else {
        const standardOptions = finalSelectOptions[field.optionsKey];
        if (standardOptions) {
          multiSelectOptionsToRender = Object.values(standardOptions).map(opt => ({
            value: typeof opt === 'object' && opt !== null ? opt.value : opt,
            label: typeof opt === 'object' && opt !== null ? opt.label : opt,
          }));
        } else {
          multiSelectWarningMessage = `optionsKey "${field.optionsKey}" not found in finalSelectOptions.`;
        }
      }

      if (multiSelectWarningMessage) {
        console.warn(`FormFieldRenderer: ${multiSelectWarningMessage} For field "${field.name}".`);
      }

      const customStyles = {
        control: (provided) => ({
          ...provided,
          width: "100%",
          padding: "0.2rem", // Adjusted padding to better match inputStyle's visual height
          background: "#1e293b",
          border: "1px solid #334155",
          color: "#e2e8f0",
          borderRadius: 8,
          fontSize: "1rem",
          minHeight: "auto", // Ensure it's not too tall by default
        }),
        input: (provided) => ({
          ...provided,
          color: "#e2e8f0",
        }),
        singleValue: (provided) => ({
          ...provided,
          color: "#e2e8f0",
        }),
        placeholder: (provided) => ({
          ...provided,
          color: "#94a3b8",
        }),
        option: (provided, state) => ({
          ...provided,
          backgroundColor: state.isFocused ? "#334155" : "#1e293b",
          color: "#e2e8f0",
          "&:active": {
            backgroundColor: "#475569",
          },
        }),
        menu: (provided) => ({
          ...provided,
          backgroundColor: "#1e293b",
          border: "1px solid #334155",
        }),
        multiValue: (provided) => ({
          ...provided,
          backgroundColor: "#334155",
          borderRadius: 4,
        }),
        multiValueLabel: (provided) => ({
          ...provided,
          color: "#e2e8f0",
        }),
        multiValueRemove: (provided) => ({
          ...provided,
          color: "#cbd5e1",
          "&:hover": {
            backgroundColor: "#ef4444",
            color: "white",
          },
        }),
      };

      return (
        <div style={{ ...fieldWrapperStyle, display: "inline-block" }}>
          <label style={labelStyle}>{field.label}</label>
          <Select
            isMulti
            name={field.name}
            options={multiSelectOptionsToRender}
            classNamePrefix="react-select"
            styles={customStyles}
            value={multiSelectOptionsToRender.filter(option => (formValues[field.name] || []).includes(option.value))}
            onChange={(selectedOptions) => handleChange(field.name, selectedOptions ? selectedOptions.map(option => option.value) : [])}
            placeholder={field.placeholder || "Select multiple options..."}
            isDisabled={multiSelectWarningMessage !== null}
          />
        </div>
      );
    case "multi_employee_select": {
        const customStyles = {
            control: (provided) => ({ ...provided, width: "100%", padding: "0.2rem", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8, fontSize: "1rem", minHeight: "auto" }),
            input: (provided) => ({ ...provided, color: "#e2e8f0" }),
            singleValue: (provided) => ({ ...provided, color: "#e2e8f0" }),
            placeholder: (provided) => ({ ...provided, color: "#94a3b8" }),
            option: (provided, state) => ({ ...provided, backgroundColor: state.isFocused ? "#334155" : "#1e293b", color: "#e2e8f0", "&:active": { backgroundColor: "#475569" } }),
            menu: (provided) => ({ ...provided, backgroundColor: "#1e293b", border: "1px solid #334155" }),
            multiValue: (provided) => ({ ...provided, backgroundColor: "#334155", borderRadius: 4 }),
            multiValueLabel: (provided) => ({ ...provided, color: "#e2e8f0" }),
            multiValueRemove: (provided) => ({ ...provided, color: "#cbd5e1", "&:hover": { backgroundColor: "#ef4444", color: "white" } }),
        };
        return (
            <div style={{ ...fieldWrapperStyle, display: "inline-block" }}>
                <label style={labelStyle}>{field.label}</label>
                <Select
                    isMulti
                    name={field.name}
                    options={employeeOptions}
                    classNamePrefix="react-select"
                    styles={customStyles}
                    value={employeeOptions.filter(option => (formValues[field.name] || []).includes(option.value))}
                    onChange={(selectedOptions) => handleChange(field.name, selectedOptions ? selectedOptions.map(option => option.value) : [])}
                    placeholder={field.placeholder || "Select employee(s)..."}
                    isClearable
                />
            </div>
        );
    }
    case "employee_select": {
        const customStyles = {
            control: (provided) => ({ ...provided, width: "100%", padding: "0.2rem", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8, fontSize: "1rem", minHeight: "auto" }),
            input: (provided) => ({ ...provided, color: "#e2e8f0" }),
            singleValue: (provided) => ({ ...provided, color: "#e2e8f0" }),
            placeholder: (provided) => ({ ...provided, color: "#94a3b8" }),
            option: (provided, state) => ({ ...provided, backgroundColor: state.isFocused ? "#334155" : "#1e293b", color: "#e2e8f0", "&:active": { backgroundColor: "#475569" } }),
            menu: (provided) => ({ ...provided, backgroundColor: "#1e293b", border: "1px solid #334155" }),
        };
        return (
            <div style={{ ...fieldWrapperStyle, display: "inline-block" }}>
                <label style={labelStyle}>{field.label}</label>
                <Select
                    name={field.name}
                    options={employeeOptions}
                    classNamePrefix="react-select"
                    styles={customStyles}
                    value={employeeOptions.find(option => option.value === formValues[field.name]) || null}
                    onChange={(selectedOption) => handleChange(field.name, selectedOption ? selectedOption.value : '')}
                    placeholder={field.placeholder || "Select an employee..."}
                    isClearable
                />
            </div>
        );
    }
case "textarea":
  return (
    <div style={{ ...fieldWrapperStyle, display: "inline-block" }}>
      <label style={labelStyle}>{field.label}</label>
      <textarea
        name={field.name}
        rows={field.rows || 4}
        value={formValues[field.name] || ""}
        onChange={e => {
          handleChange(field.name, e.target.value);
        }}
        placeholder={field.placeholder || ""}
        style={inputStyle}
        data-field={field.name}
      />
      {field.allowImagePaste && (
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
    </div>
  );    case "image":
      return (
        <div style={{ ...fieldWrapperStyle, display: "inline-block" }}>
          <label style={labelStyle}>{field.label}</label>
<ImageUploader
        images={formValues[field.name] || []}           // ← Always array
        onImagesChange={(newImages) => handleChange(field.name, newImages)} // ← Save array
        maxImages={field.maxImages || 6}
        fieldName={field.name}
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
                  {Object.values(finalSelectOptions[field.associatedInputField.optionsKey]).map((opt, index) => {
                    const value = typeof opt === 'object' && opt !== null ? opt.value : opt;
                    const label = typeof opt === 'object' && opt !== null ? opt.label : opt;
                    return <option key={`${value}-${index}`} value={value}>{label}</option>
                  })}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start', width: '100%' }}>
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
    case "payment_button": {
      const [step, setStep] = useState(0);
      const { user: gtawUser } = useGtaWorldAuth();

      // Effect to listen for localStorage changes from the callback tab
      useEffect(() => {
        const handleStorageChange = (event) => {
          if (event.key === 'phmc-payment-confirmed') {
            const confirmationData = JSON.parse(event.newValue);
            // Check if this update is for this specific button instance
            if (confirmationData && confirmationData.fieldId === field.name) {
              handleChange(field.name, confirmationData);
              // Clean up the confirmation key so it doesn't trigger again
              localStorage.removeItem('phmc-payment-confirmed');
              localStorage.removeItem('phmc-payment-pending');
            }
          }
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
          window.removeEventListener('storage', handleStorageChange);
        };
      }, [field.name, handleChange]);


      // Effect to set the initial step and handle timeouts
      useEffect(() => {
        const value = formValues[field.name];
        const TEN_MINUTES_IN_MS = 10 * 60 * 1000;
        const THIRTY_MINUTES_IN_MS = 30 * 60 * 1000;

        if (value && value.status === 'confirmed' && value.confirmedAt) {
          const confirmationTime = new Date(value.confirmedAt).getTime();
          const now = new Date().getTime();
          
          if (now - confirmationTime < THIRTY_MINUTES_IN_MS) {
            setStep(3); // Payment is confirmed and not expired
          } else {
            showNotification('Your previous payment confirmation has expired.', 'warning');
            handleChange(field.name, null);
            setStep(0);
          }
        } else if (value === 'pending_confirmation') {
            const pendingPaymentRaw = localStorage.getItem('phmc-payment-pending');
            if (pendingPaymentRaw) {
                const pendingPayment = JSON.parse(pendingPaymentRaw);
                const pendingTime = pendingPayment.timestamp || 0;
                const now = new Date().getTime();

                if (now - pendingTime < TEN_MINUTES_IN_MS) {
                    setStep(2); // Payment is pending and not expired
                } else {
                    showNotification('Your payment session has expired. Please restart the payment process.', 'warning');
                    localStorage.removeItem('phmc-payment-pending');
                    handleChange(field.name, null);
                    setStep(0);
                }
            } else {
                 // If state is pending but no localStorage item, reset.
                handleChange(field.name, null);
                setStep(0);
            }
        } else {
          setStep(0); // Initial state
        }
      }, [formValues, field.name, handleChange, showNotification]);

      const paymentValue = useMemo(() => {
        if (field.paymentTotal) {
            return field.paymentTotal;
        }
        if (selectedForm && selectedForm.name.includes('Patient File')) {
          return 2000;
        }
        return 0;
      }, [field.paymentTotal, selectedForm]);

      const handleRestartPayment = () => {
          handleChange(field.name, null);
          localStorage.removeItem('phmc-payment-pending');
          setStep(0);
          showNotification('Payment process has been reset.', 'info');
      };

      const handlePayment = () => {
        if (!gtawUser) {
          alert("Authentication error: You must be logged in to proceed with a payment.");
          return;
        }

        const apiKey = "QpDlr9TcWwAWjs07gqq9rpqeygqBYlYMQ4bGPUmx9ILPx6vs6xflO6BIdhncCcAu";
        const baseURL = "https://banking.gta.world/gateway";
        const url = `${baseURL}/${apiKey}/0/${paymentValue}`;

        const pendingPayment = {
          userId: gtawUser.userId,
          formName: selectedForm.name,
          fieldId: field.name,
          timestamp: new Date().getTime(),
        };
        localStorage.setItem('phmc-payment-pending', JSON.stringify(pendingPayment));
        
        window.open(url, '_blank');
        handleChange(field.name, 'pending_confirmation');
        setStep(2);
      };

      return (
        <div style={fieldWrapperStyle}>
          <label style={labelStyle}>{field.label}</label>
          <div style={{ padding: '1rem', background: '#162032', borderRadius: 8 }}>
            {step === 0 && (
              <div>
                <p style={{ color: "#cbd5e1", margin: "0 0 1rem" }}>Please visit <a href="https://banking.gta.world/login" target="_blank" rel="noopener noreferrer">the banking website</a> to log in before proceeding.</p>
                <button onClick={() => setStep(1)} style={{ background: "#6366f1", color: "white", border: "none", padding: "0.8rem 1.5rem", borderRadius: 8, width: '100%' }}>I have logged in, proceed to payment</button>
              </div>
            )}
            {step === 1 && (
              <div>
                <p style={{ color: "#cbd5e1", margin: "0 0 1rem" }}>Please click the button below to make a payment of <strong>${paymentValue}</strong> to Pillbox Hill Medical Center.</p>
                <button onClick={handlePayment} style={{ background: "#10b981", color: "white", border: "none", padding: "0.8rem 1.5rem", borderRadius: 8, width: '100%' }}>Pay Now</button>
              </div>
            )}
            {step === 2 && (
              <div style={{ color: "#f59e0b" }}>
                <p style={{ margin: 0 }}>Waiting for payment confirmation...</p>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.5rem' }}>Once you have paid and the Fleeca Bank has indicated 'OK', come back to this tab and click on 'I've Paid'. If you encounter an issue, you can restart.</p>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button
                      onClick={() => {
                        const confirmationData = {
                            fieldId: field.name,
                            confirmedAt: new Date().toISOString(),
                            status: 'confirmed'
                        };
                        localStorage.setItem('phmc-payment-confirmed', JSON.stringify(confirmationData)); // To ensure consistency for other components
                        handleChange(field.name, confirmationData);
                      }}
                      style={{
                        background: "#007bff",
                        color: "white",
                        border: "none",
                        padding: "0.8rem 1.5rem",
                        borderRadius: 8,
                        width: '100%',
                      }}
                    >
                      I've Paid 
                    </button>
                    <button
                      onClick={handleRestartPayment}
                      style={{
                        background: "#dc3545",
                        color: "white",
                        border: "none",
                        padding: "0.8rem 1.5rem",
                        borderRadius: 8,
                        width: '100%',
                      }}
                    >
                      Restart
                    </button>
                </div>
              </div>
            )}
            {step === 3 && formValues[field.name] && formValues[field.name].confirmedAt && (
              <div style={{ color: "#34d399" }}>
                <p style={{ margin: 0 }}>Payment Confirmed at:</p>
                <strong>{new Date(formValues[field.name].confirmedAt).toLocaleString()}</strong>
              </div>
            )}
          </div>
        </div>
      );
    }
    case "attach_report_button": {
      const [attachedReportSummaries, setAttachedReportSummaries] = useState([]);
      const targetField = field.targetField;

      useEffect(() => {
        // If the target field is cleared from outside, clear the summaries.
        if (!formValues[targetField]) {
          setAttachedReportSummaries([]);
        }
      }, [formValues[targetField]]);

      return (
        <div style={fieldWrapperStyle}>
          <button
            onClick={() => {
              // console.log("Attach report button clicked!");
              const callback = (reportData) => {
                // console.log(`[FormFieldRenderer Callback] Received reportData:`, reportData);
                // console.log(`[FormFieldRenderer Callback] reportData.bbCode value:`, reportData?.bbCode);
                if (reportData && reportData.bbCode) {
                  const targetField = field.targetField;
                  // Use functional update to ensure we always get the latest state
                  // The useReportManagement hook now handles updating formValues directly.
                  // This callback is now only responsible for local UI updates and notifications.
                  if(showNotification) showNotification('Report attached!', 'success');
                  
                  // Add the confirmation message to the array
                  setAttachedReportSummaries(prev => [...prev, `Report "${reportData.originalKey}" attached to "${targetField}"!`]);
                }
              };
              toggleSavedReports(null, field.employeeType, callback, field.targetField);
            }}
            style={{
              padding: "0.8rem 1.5rem",
              background: "#17a2b8",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            {field.label}
          </button>
          {attachedReportSummaries.length > 0 && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#34d399' }}>
              {attachedReportSummaries.map((summary, index) => (
                <div key={index}>{summary}</div>
              ))}
            </div>
          )}
        </div>
      );
    }
    case "decedent_list": {
      const decedentItemSchema = useMemo(() => {
        try {
          return JSON.parse(field.decedentItemSchemaJson);
        } catch (e) {
          console.error("Error parsing decedentItemSchemaJson:", e);
          return [];
        }
      }, [field.decedentItemSchemaJson]);

      const decedentList = formValues[field.name] || [];

      const addDecedent = useCallback(() => {
        const newDecedent = decedentItemSchema.reduce((acc, subField) => {
          if (subField.type === 'image') {
            acc[subField.name] = []; // Initialize image fields as empty arrays
          } else {
            acc[subField.name] = '';
          }
          return acc;
        }, {});
        handleChange(field.name, [...decedentList, newDecedent]);
      }, [field.name, decedentList, handleChange, decedentItemSchema]);

      const handleDecedentItemChange = useCallback((indexToUpdate, subFieldName, subFieldValue) => {
        const updatedList = decedentList.map((item, idx) => {
          if (idx === indexToUpdate) {
            return { ...item, [subFieldName]: subFieldValue };
          }
          return item;
        });
        handleChange(field.name, updatedList);
      }, [field.name, decedentList, handleChange]);

      const removeDecedent = useCallback((indexToRemove) => {
        const updatedList = decedentList.filter((_, idx) => idx !== indexToRemove);
        handleChange(field.name, updatedList);
      }, [field.name, decedentList, handleChange]);

      return (
        <div style={{ margin: "0 8px 1.5rem", width: "calc(100% - 16px)", boxSizing: "border-box" }}>
          <label style={labelStyle}>{field.label || "Decedent List"}</label>
          {decedentList.map((item, index) => (
            <DecedentItemRenderer
              key={index} // Consider a more stable key if items can be reordered
              itemValues={item}
              itemSchema={decedentItemSchema}
              onItemChange={(subFieldName, subFieldValue) => handleDecedentItemChange(index, subFieldName, subFieldValue)}
              onRemove={() => removeDecedent(index)}
              index={index}
              finalSelectOptions={finalSelectOptions}
              currentUtcTime={currentUtcTime}
              agencyDataStore={agencyDataStore}
              showNotification={showNotification}
            />
          ))}
          <button onClick={addDecedent} style={{ background: "#10b981", color: "white", border: "none", padding: "0.8rem 1.5rem", borderRadius: 8, cursor: "pointer", width: "100%" }}>
            Add Decedent
          </button>
        </div>
      );
    }
    case "dynamic_text_list": {
      const listItems = Array.isArray(formValues[field.name]) ? formValues[field.name] : [];

      const addListItem = useCallback(() => {
        handleChange(field.name, [...listItems, ""]); // Add an empty string for a new item
      }, [field.name, listItems, handleChange]);

      const handleItemChange = useCallback((indexToUpdate, value) => {
        const updatedList = listItems.map((item, idx) => {
          if (idx === indexToUpdate) {
            return value;
          }
          return item;
        });
        handleChange(field.name, updatedList);
      }, [field.name, listItems, handleChange]);

      const removeListItem = useCallback((indexToRemove) => {
        const updatedList = listItems.filter((_, idx) => idx !== indexToRemove);
        handleChange(field.name, updatedList);
      }, [field.name, listItems, handleChange]);

      return (
        <div style={{ ...fieldWrapperStyle }}>
          <label style={labelStyle}>{field.label}</label>
          {listItems.map((item, index) => (
            <div key={index} style={{ display: "flex", alignItems: "center", marginBottom: "0.5rem" }}>
              <input
                type="text"
                value={item}
                onChange={(e) => handleItemChange(index, e.target.value)}
                style={{ ...inputStyle, flexGrow: 1, marginRight: "0.5rem" }}
                placeholder={`${field.label} Item ${index + 1}`}
              />
              <button
                onClick={() => removeListItem(index)}
                style={{ background: "#ef4444", color: "white", border: "none", padding: "0.5rem 0.8rem", borderRadius: 8, cursor: "pointer" }}
              >
                Remove
              </button>
            </div>
          ))}
          <button onClick={addListItem} style={{ background: "#10b981", color: "white", border: "none", padding: "0.8rem 1.5rem", borderRadius: 8, cursor: "pointer", width: "100%" }}>
            {field.buttonLabel || "Add Item"}
          </button>
        </div>
      );
    }
    case "autopsy_diagram_button": {
        const [showModal, setShowModal] = useState(false);
        const initialMarkers = formValues[`${field.name}_markers`] || [];

        return (
            <div style={fieldWrapperStyle}>
                <label style={labelStyle}>{field.label}</label>
                <button
                    onClick={() => setShowModal(true)}
                    style={{
                        padding: "0.8rem 1.5rem",
                        background: "#6366f1",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        fontSize: "1rem",
                        fontWeight: "600",
                        cursor: "pointer",
                        width: "100%"
                    }}
                >
                    {field.label}
                </button>
                {formValues[field.name] && (
                    <div style={{ marginTop: '10px', fontSize: '0.9rem', color: '#34d399' }}>
                        Diagram URL: <a href={formValues[field.name]} target="_blank" rel="noopener noreferrer" style={{ color: '#34d399', textDecoration: 'underline' }}>View Diagram</a>
                    </div>
                )}

                <AutopsyDiagramModal
                    show={showModal}
                    onHide={() => setShowModal(false)}
                    onSaveDiagram={(markers, imageUrl) => {
                        handleChange(field.name, imageUrl); // Save the image URL
                        handleChange(`${field.name}_markers`, markers); // Save the markers data
                        setShowModal(false);
                    }}
                    initialMarkers={initialMarkers}
                    showNotification={showNotification}
                    removeNotification={() => { /* Not used by modal, but good to pass */ }}
                    handleImageUpload={handleDiagramUpload}
                />
            </div>
        );
    }
    case "character_selector":
      return (
          <div style={{ ...fieldWrapperStyle, display: "inline-block" }}>
              <CharacterSelector
                  label={field.label}
                  onCharacterSelect={(character) => handleChange(field.name, character ? character.fullName : '')}
                  forceDropdown={true}
              />
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