import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Select from 'react-select';
import ImageUploader from './ImageUploader'; // Assuming ImageUploader is in the same directory or adjust path
import { getUtcFormattedDateTime, getUtcFormattedTime } from '../../utils/dateTimeUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth'; // Import useGtaWorldAuth
import DecedentItemRenderer from './DecedentItemRenderer'; // Import the new component
import AutopsyDiagramModal from '../Modals/AutopsyDiagramModal'; // Import AutopsyDiagramModal
import CharacterSelector from '../Modals/CharacterSelector';
import { decedentItemSchema } from '../../formSchemas/decedentSchema';
import { formatCharacterNameForDisplay } from '../../utils/characterUtils'; // Import the new utility
import { useModal } from '../../contexts/ModalProvider';
import { evaluateFieldVisibility } from '../../utils/formValidation';

import morgueGif from '../../assets/morgue-copy-tutorial.gif';

const FormFieldRenderer = ({ field, selectedForm, formValues, handleChange, finalSelectOptions, currentUtcTime, agencyDataStore, toggleSavedReports, showNotification, isUploading, handleDiagramUpload, setShowMapModal, setMapTargetField, isUploadingMapImage = {}, setShowAutopsyAssistModal, setAutopsyAssistTargetField, setIsAttachModeForModal }) => {
  const { factionsData } = useData();
  const { openImagePreview } = useModal();

  const employeeOptions = useMemo(() => {
    if (!factionsData || !factionsData['364'] || !factionsData['364'].members) return [];
    return Object.values(factionsData['364'].members)
        .map(member => ({
            value: member.characterName, // Use name as value
            label: formatCharacterNameForDisplay(member.characterName) 
        }))
        .sort((a, b) => a.label.localeCompare(b.label)); // Sort alphabetically
  }, [factionsData]);

  // Conditional visibility logic
  if (!evaluateFieldVisibility(field, formValues)) {
    return null;
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
    case "section":
      return (
        <div 
          data-tour-id={field.id}
          data-tour-name={field.name}
          data-tour-type={field.type}
          style={{ 
            margin: "2rem 8px 1rem", 
            width: "calc(100% - 16px)", 
            boxSizing: "border-box",
            borderBottom: "2px solid #334155",
            paddingBottom: "0.5rem"
        }}>
            <h3 style={{ 
                color: "#60a5fa", 
                margin: 0, 
                fontSize: "1.2rem", 
                textTransform: "uppercase", 
                letterSpacing: "0.1rem",
                display: "flex",
                alignItems: "center",
                gap: "10px"
            }}>
                <i className={field.icon || "fas fa-folder-open"} style={{ opacity: 0.7 }}></i>
                {field.label}
            </h3>
        </div>
      );
    case "small_header":
      return (
        <div style={{ margin: "1.5rem 8px 0.8rem", width: "calc(100% - 16px)", boxSizing: "border-box" }}>
          <h4 style={{ 
              color: "#a78bfa", 
              margin: 0, 
              fontSize: "1rem", 
              display: "flex", 
              alignItems: "center", 
              gap: "8px" 
          }}>
            <i className={field.icon || "fas fa-chevron-right"} style={{ fontSize: "0.8rem", opacity: 0.5 }}></i>
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
    case "timer": {
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
                  if (field.buttonAction === "set_current_time" || field.buttonAction === "capture") {
                    let capturedValue = "";
                    
                    if (field.timerType === "datetime-local" || field.timerType === "dateTime") {
                      // Capture both date and time (YYYY-MM-DDTHH:MM)
                      capturedValue = getUtcFormattedDateTime();
                    } else if (field.timerType === "date") {
                      // Capture date only (YYYY-MM-DD)
                      const now = new Date();
                      const pad = (n) => n.toString().padStart(2, '0');
                      capturedValue = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
                    } else if (field.timerType === "time") {
                      // Capture time only (HH:MM)
                      capturedValue = getUtcFormattedTime();
                    } else {
                      // Default fallback to datetime
                      capturedValue = getUtcFormattedDateTime();
                    }
                    
                    handleChange(field.name, capturedValue);
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
    }
    case "select": {
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
        <div 
          data-tour-id={field.id} 
          data-tour-name={field.name}
          data-tour-type={field.type}
          style={{ ...fieldWrapperStyle, display: "inline-block" }}
        >
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
    }
    case "multi_select": {
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
    }
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
        <div 
          data-tour-id={field.id} 
          data-tour-name={field.name}
          data-tour-type={field.type}
          style={{ ...fieldWrapperStyle, display: "inline-block" }}
        >
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
        </div>
      );
    case "image":
      return (
        <div style={{ ...fieldWrapperStyle, display: "inline-block" }}>
          <label style={labelStyle}>{field.label}</label>
          <ImageUploader
            images={formValues[field.name] || []}
            onImagesChange={(newImages) => handleChange(field.name, newImages)}
            notes={formValues[`${field.name}_narrative`] || ""}
            onNotesChange={(newNotes) => handleChange(`${field.name}_narrative`, newNotes)}
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
          showNotification("Authentication error: You must be logged in to proceed with a payment.", "error");
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
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.5rem' }}>Once you have paid and the Fleeca Bank has indicated &apos;OK&apos;, come back to this tab and click on &apos;I&apos;ve Paid&apos;. If you encounter an issue, you can restart.</p>
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
                      I&apos;ve Paid 
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
                <button
                  onClick={handleRestartPayment}
                  style={{
                    background: "#ef4444", // Red color for reset/danger
                    color: "white",
                    border: "none",
                    padding: "0.5rem 1rem",
                    borderRadius: 8,
                    fontSize: "0.9rem",
                    fontWeight: "600",
                    marginTop: "1rem",
                    width: "100%",
                    cursor: "pointer"
                  }}
                >
                  Reset Payment
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }
    case "autopsy_import_button": {
      const [step, setStep] = useState(0);
      const [inputText, setInputText] = useState("");
      const [parsedData, setParsedData] = useState(null);
      const [selectedSuggestions, setSelectedSuggestions] = useState([]);

      // Effect to initialize selectedSuggestions when parsedData changes
      useEffect(() => {
        if (parsedData && parsedData.suggestedCausesOfDeath) {
          setSelectedSuggestions(parsedData.suggestedCausesOfDeath); // Select all by default
        } else {
          setSelectedSuggestions([]);
        }
      }, [parsedData]);

      const handleToggleSuggestion = useCallback((cause) => {
        setSelectedSuggestions(prev => 
          prev.includes(cause) ? prev.filter(c => c !== cause) : [...prev, cause]
        );
      }, []);

      const handleApplySelectedSuggestions = useCallback(() => {
        handleChange('deathCausesListItems', selectedSuggestions);
        showNotification("Selected causes successfully applied!", "success");
      }, [handleChange, selectedSuggestions, showNotification]);

      // Mapping for suggested causes of death based on wound types
      const causeOfDeathSuggestionsMap = {
        'gunshot wound': ["Massive blood loss due to gunshot wounds", "Damage to vital organs by gunshot", "Internal hemorrhage from gunshot wounds", "Acute blood loss from gunshot wounds"],
        'stab wound': ["Exsanguination due to stab wounds", "Damage to vital organs by stab wound", "Internal hemorrhage from stab wounds"],
        'blunt force trauma': ["Massive internal bleeding from blunt force trauma", "Traumatic brain injury", "Damage to vital organs from blunt force trauma"],
        // Add more as needed
      };

      const parseMorgueData = (text) => {
        const data = {};
        
        // Case Number
        const caseMatch = text.match(/CASE #(\d+)/);
        if (caseMatch) data.caseNumber = caseMatch[1];
        
        // Name and OOC
        const nameMatch = text.match(/NAME:\s*\n(.*?)\s*\(\(\s*(.*?)\s*\)\)/);
        if (nameMatch) {
          let name = nameMatch[1].trim();
          if (name.toLowerCase() === 'unknown') name = "John Doe";
          data.decedentName = name;
          data.decedentOOC = nameMatch[2].trim();
        }

        // DNA Profile
        const dnaMatch = text.match(/DNA PROFILE\s*\n([A-F0-9]+)/);
        if (dnaMatch) data.dnaProfile = dnaMatch[1].trim();

        // Sex
        const sexMatch = text.match(/SEX:\s*\n(Male|Female)/i);
        if (sexMatch) {
          const sex = sexMatch[1].toLowerCase();
          data.sex = sex.charAt(0).toUpperCase() + sex.slice(1);
        }

        // Place of Death
        const locMatch = text.match(/LOCATION:\s*\n(.+)/);
        if (locMatch) data.placeOfDeath = locMatch[1].trim();
        
        // Physical Description -> External Examination
        const physicalDescMatch = text.match(/PHYSICAL DESCRIPTION\s*\n([\s\S]*?)(?=FORENSIC DETAILS|AUTOPSY FINDINGS|$)/);
        if (physicalDescMatch) {
          const prefix = data.decedentOOC ? `(( ${data.decedentOOC}'s /examine\n\n` : "Autopsy Tech Examination of Decedent:\n\n";
          data.externalExamination = prefix + physicalDescMatch[1].trim() + (data.decedentOOC ? ' ))' : '');
        }

        // Forensic Details (BAC/Narcotics)
        const bacMatch = text.match(/Blood alcohol concentration \(BAC\)\s*\n([\d.]+%)/);
        if (bacMatch) data.bacLevel = bacMatch[1].trim();

        const narcoticsMatch = text.match(/Traces of narcotics\s*\n(.+)/);
        if (narcoticsMatch) data.narcoticTraces = narcoticsMatch[1].trim();

        // Casings (Multiple)
        const casingRegex = /Bullet recovered with striation marks - (.*?)\s*\n#(.*)/g;
        let casingMatch;
        const casings = [];
        while ((casingMatch = casingRegex.exec(text)) !== null) {
          casings.push(`Bullet found with striation marks (${casingMatch[1].trim()}) #${casingMatch[2].trim()}`);
        }
        const hasCasings = casings.length > 0; // Evaluate once
        if (hasCasings) {
          data.casings = casings;
          data.RadiologyResult = `${casings.length} projectiles/slugs were identified via fluoroscopy and recovered during the autopsy.`;
        }

        // Autopsy Findings
        const findingsSection = text.split('AUTOPSY FINDINGS')[1];
        if (findingsSection) {
          const lines = findingsSection.trim().split('\n').slice(1);
          const findings = lines.map(line => {
            const parts = line.split('\t');
            if (parts.length >= 4) {
              const type = parts[1].trim();
              const part = parts[2].trim();
              const dist = parts[3].trim().replace(/[^\d.]/g, ''); // Extract number
              const distParsed = parseFloat(dist);
              const distRounded = !isNaN(distParsed) ? Math.floor(distParsed) : null;
              const typeLower = type.toLowerCase();

              // Only skip blood loss or missing body parts
              if (typeLower === 'blood loss' || part === '—') {
                return null;
              }
              
              if (typeLower === 'gunshot wound') {
                const rangeText = distRounded !== null ? `, estimated range ${distRounded}m` : '';
                return `Gunshot Wound to ${part}${rangeText}`;
              } else if (typeLower === 'blunt force trauma' || typeLower === 'stab wound') {
                const formattedType = typeLower.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                return `${formattedType} to ${part}`;
              }
              
              const rangeSuffix = distRounded !== null ? ` (${distRounded}m)` : '';
              return `${type} to ${part}${rangeSuffix}`;
            }
            return line.trim();
          }).filter(l => l && l.length > 0);
          if (findings.length > 0) {
            data.anatomicSummaryListItems = findings;
          }
        }
        
        // Generate suggested causes of death
        if (data.anatomicSummaryListItems && data.anatomicSummaryListItems.length > 0) {
          const uniqueWoundTypes = new Set();
          let hasGunshotToHead = false;

          data.anatomicSummaryListItems.forEach(item => {
            const match = item.match(/^(Gunshot Wound|Blunt Force Trauma|Stab Wound)\s+to\s+(.*?)(?:,|$)/i); // Extract body part
            if (match) {
              const woundType = match[1].toLowerCase();
              const bodyPart = match[2].trim().toLowerCase();
              uniqueWoundTypes.add(woundType);

              if (woundType === 'gunshot wound' && bodyPart === 'head') {
                hasGunshotToHead = true;
              }
            }
          });

          const suggestedCauses = [];
          uniqueWoundTypes.forEach(woundType => {
            if (causeOfDeathSuggestionsMap[woundType]) {
              suggestedCauses.push(...causeOfDeathSuggestionsMap[woundType]);
            }
          });

          // Add specific suggestion for gunshot to head
          if (hasGunshotToHead && uniqueWoundTypes.has('gunshot wound')) { // Ensure it's a gunshot wound and to the head
            suggestedCauses.push("Multiple gunshot wounds, with a fatal penetrating trauma to the head");
          }
          
          data.suggestedCausesOfDeath = [...new Set(suggestedCauses)]; // Remove duplicates
        }

        return data;
      };

      const handleProcess = () => {
        const data = parseMorgueData(inputText);
        setParsedData(data);
        setStep(2);
      };

      const handleApply = () => {
        if (parsedData) {
          Object.keys(parsedData).forEach(key => {
            handleChange(key, parsedData[key]);
          });
          setStep(3);
          showNotification("Morgue data successfully imported!", "success");
        }
      };

      return (
        <div style={fieldWrapperStyle}>
          <label style={labelStyle}>{field.label}</label>
          <div style={{ padding: '1rem', background: '#162032', borderRadius: 8 }}>
            {step === 0 && (
              <div>
                <p style={{ color: "#cbd5e1", margin: "0 0 1rem" }}>Use this tool to automatically fill the form by pasting the morgue data output.</p>
                <button onClick={() => setStep(1)} style={{ background: "#6366f1", color: "white", border: "none", padding: "0.8rem 1.5rem", borderRadius: 8, width: '100%' }}>
                    <i className="fas fa-file-import" style={{ marginRight: '8px' }}></i> Start Import
                </button>
              </div>
            )}
            {step === 1 && (
              <div>
                <p style={{ color: "#cbd5e1", margin: "0 0 0.5rem" }}>Upload Morgue Data here</p>
                <button
                  onClick={() => openImagePreview(morgueGif)}
                  style={{ background: "#6366f1", color: "white", border: "none", padding: "0.5rem 1rem", borderRadius: 8, marginBottom: '1rem' }}
                >
                  Gif Tutorial
                </button>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste the morgue output here..."
                  style={{ ...inputStyle, minHeight: '150px', marginBottom: '1rem', fontSize: '0.8rem', fontFamily: 'monospace' }}
                />
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={handleProcess} style={{ background: "#10b981", color: "white", border: "none", padding: "0.8rem 1.5rem", borderRadius: 8, flex: 1 }}>Process Data</button>
                    <button onClick={() => setStep(0)} style={{ background: "#475569", color: "white", border: "none", padding: "0.8rem 1.5rem", borderRadius: 8, flex: 1 }}>Cancel</button>
                </div>
              </div>
            )}
            {step === 2 && (
              <div>
                <p style={{ color: "#cbd5e1", margin: "0 0 1rem" }}>Review the data identified:</p>
                <div style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '4px', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>
                    {parsedData && Object.keys(parsedData).length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: '20px' }}>
                            {parsedData.decedentName && <li><strong>Name:</strong> {parsedData.decedentName} (({parsedData.decedentOOC}))</li>}
                            {parsedData.sex && <li><strong>Sex:</strong> {parsedData.sex}</li>}
                            {parsedData.dnaProfile && <li><strong>DNA:</strong> {parsedData.dnaProfile}</li>}
                            {parsedData.caseNumber && <li><strong>Case #:</strong> {parsedData.caseNumber}</li>}
                            {parsedData.placeOfDeath && <li><strong>Location:</strong> {parsedData.placeOfDeath}</li>}
                            {parsedData.dateTime && <li><strong>Time:</strong> {parsedData.dateTime}</li>}
                            {parsedData.bacLevel && <li><strong>BAC:</strong> {parsedData.bacLevel}</li>}
                            {parsedData.narcoticTraces && <li><strong>Narcotics:</strong> {parsedData.narcoticTraces}</li>}
                            {parsedData.externalExamination && <li><strong>External Exam:</strong> Extracted</li>}
                            {parsedData.casings && <li><strong>Casings:</strong> {parsedData.casings.length} found</li>}
                            {parsedData.anatomicSummaryListItems && <li><strong>Findings:</strong> {parsedData.anatomicSummaryListItems.length} items found</li>}
                        </ul>
                    ) : (
                        <p style={{ color: '#ef4444', margin: 0 }}>No valid data could be identified. Please check your input or contact Alyson Frost for assistance.</p>
                    )}

                    {parsedData && parsedData.suggestedCausesOfDeath && parsedData.suggestedCausesOfDeath.length > 0 && (
                        <div style={{ marginTop: '1rem', borderTop: '1px solid #334155', paddingTop: '1rem' }}>
                            <p style={{ margin: '0 0 0.5rem', color: '#fcd34d' }}><strong>Suggested Causes of Death:</strong></p>
                            <div style={{ maxHeight: '150px', overflowY: 'auto', paddingRight: '10px' }}> {/* Scrollable area */}
                            {parsedData.suggestedCausesOfDeath.map((cause, index) => (
                                <div key={index} style={{ marginBottom: '5px', display: 'flex', alignItems: 'center' }}>
                                    <input
                                        type="checkbox"
                                        id={`suggested-cause-${index}`}
                                        checked={selectedSuggestions.includes(cause)}
                                        onChange={() => handleToggleSuggestion(cause)}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <label htmlFor={`suggested-cause-${index}`} style={{ margin: 0, color: '#e2e8f0' }}>{cause}</label>
                                </div>
                            ))}
                            </div>
                            <button
                                onClick={handleApplySelectedSuggestions}
                                style={{
                                    background: "#3b82f6",
                                    color: "white",
                                    border: "none",
                                    padding: "0.5rem 1rem",
                                    borderRadius: 8,
                                    fontSize: "0.9rem",
                                    fontWeight: "600",
                                    marginTop: "1rem",
                                    width: "100%"
                                }}
                            >
                                Apply Selected Suggestions
                            </button>
                        </div>
                    )}
                </div>
                
                <div style={{ background: '#3d301a', border: '1px solid #f59e0b', padding: '0.8rem', borderRadius: '4px', fontSize: '0.8rem', color: '#fcd34d', marginBottom: '1rem' }}>
                    <i className="fas fa-exclamation-triangle" style={{ marginRight: '6px' }}></i>
                    <strong>Manual Action Required:</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: '20px' }}>
                        <li>Review the parsed data for accuracy</li>
                        <li>Add the Autopsy Start Time</li>
                        <li>Add Injury Mechanism, Manner of Death and Cause of Death</li>
                        <li> Review the Autopsy Request and add in the External Examination (if scene photos are provoided) </li>
                        <li>Summerize with the ME Opinion</li>
                    </ul>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button 
                        onClick={handleApply} 
                        disabled={!parsedData || Object.keys(parsedData).length === 0}
                        style={{ background: "#10b981", color: "white", border: "none", padding: "0.8rem 1.5rem", borderRadius: 8, flex: 2, opacity: (!parsedData || Object.keys(parsedData).length === 0) ? 0.5 : 1 }}
                    >Apply to Form</button>
                    <button onClick={() => setStep(1)} style={{ background: "#475569", color: "white", border: "none", padding: "0.8rem 1.5rem", borderRadius: 8, flex: 1 }}>Back</button>
                </div>
              </div>
            )}
            {step === 3 && (
              <div style={{ textAlign: 'center' }}>
                <i className="fas fa-check-circle" style={{ fontSize: '2rem', color: '#10b981', marginBottom: '0.5rem' }}></i>
                <p style={{ color: "#34d399", fontWeight: 'bold' }}>Data Successfully Applied!</p>
                <button onClick={() => { setStep(0); setInputText(""); setParsedData(null); }} style={{ background: "#6366f1", color: "white", border: "none", padding: "0.5rem 1rem", borderRadius: 8, marginTop: '0.5rem' }}>Import Another</button>
              </div>
            )}
          </div>
        </div>
      );
    }
    case "attach_report_button": {
      // Helper to extract OOC names from Mass Fatality BBCode
      const extractMassFatalityOoc = (bbCode) => {
        if (!bbCode || typeof bbCode !== 'string') return [];
        
        // Look for OOC names in patterns like "(( Name ))" in the BBCode
        const oocMatches = bbCode.match(/\(\(\s*([^)]+)\s*\)\)/g);
        if (!oocMatches) return [];
        
        return oocMatches
          .map(match => match.replace(/\(\(\s*|\s*\)\)/g, '').trim())
          .filter((name) => {
            if (name.toLowerCase().startsWith('unknown')) return false;
            // Filter out non-name entries
            // 1. Skip all-caps entries (section headers, commands)
            if (name === name.toUpperCase() && name.length > 1) return false;
            // 2. Skip very short entries (likely not names)
            if (name.length < 2) return false;
            // 3. Skip known non-name keywords
            if (['FOR INTERNAL RECORDS', 'DO NOT USE THESE', 'THESE IMAGES ARE'].some(keyword => name.includes(keyword))) return false;
            // 4. Skip long sentences
            if (name.split(' ').length > 4) return false;
            return true;
          })
          .filter((name, idx, arr) => arr.indexOf(name) === idx); // Remove duplicates
      };

      const attachedReports = formValues.additionalReports || [];

      return (
        <div 
          data-tour-id={field.id}
          data-tour-name={field.name}
          data-tour-type={field.type}
          style={fieldWrapperStyle}
        >
          <button
            data-tour-target="button"
            onClick={() => {
              toggleSavedReports(null, field.employeeType, null, field.targetField, true);
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
          {attachedReports.length > 0 && (
            <div style={{ marginTop: '1rem', borderLeft: '3px solid #22c55e', paddingLeft: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#a78bfa', fontSize: '0.9rem', fontWeight: '600' }}>Attached Reports:</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#34d399', fontSize: '0.9rem' }}>
                {attachedReports.map((report, index) => {
                  let displayTitle = report.originalKey || `Attached Report ${index + 1}`;
                  
                  // Check if this is a Mass Fatality type report
                  const isMassFatality = report.formId && (
                    report.formId === 'mass-fatality' ||
                    report.formId === 'mass-ftality-test' ||
                    (typeof report.formId === 'string' && report.formId.toLowerCase().includes('mass'))
                  );
                  
                  if (isMassFatality && report.bbCode) {
                    const oocNames = extractMassFatalityOoc(report.bbCode);
                    if (oocNames.length > 0) {
                      displayTitle = `${report.originalKey} [${oocNames.join(', ')}]`;
                    }
                  }
                  
                  return (
                    <li key={index}>{displayTitle}</li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      );
    }
    case "decedent_list": {
      const currentDecedentItemSchema = useMemo(() => {
        return decedentItemSchema;
      }, []);

      const [activeDecedentIndex, setActiveDecedentIndex] = useState(0);
      const decedentList = formValues[field.name] || [];

      // Ensure activeDecedentIndex is within bounds if the list changes from outside
      useEffect(() => {
        if (decedentList.length > 0 && activeDecedentIndex >= decedentList.length) {
          setActiveDecedentIndex(decedentList.length - 1);
        }
      }, [decedentList.length, activeDecedentIndex]);

      const addDecedent = useCallback(() => {
        const newDecedent = decedentItemSchema.reduce((acc, subField) => {
          if (subField.type === 'image') {
            acc[subField.name] = [];
          } else if (subField.type !== 'section') {
            acc[subField.name] = '';
          }
          return acc;
        }, {});
        const newList = [...decedentList, newDecedent];
        handleChange(field.name, newList);
        setActiveDecedentIndex(newList.length - 1); // Switch to the newly added decedent
      }, [field.name, decedentList, handleChange]);

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
        
        // Adjust active index if we removed the active one or an earlier one
        if (indexToRemove <= activeDecedentIndex) {
            setActiveDecedentIndex(Math.max(0, activeDecedentIndex - 1));
        }
      }, [field.name, decedentList, handleChange, activeDecedentIndex]);

      return (
        <div 
            data-tour-id={field.id}
            data-tour-name={field.name}
            data-tour-type={field.type}
            style={{ margin: "0 8px 1.5rem", width: "calc(100% - 16px)", boxSizing: "border-box" }}
        >
          <label style={{ ...labelStyle, marginBottom: '1rem' }}>{field.label || "Decedents"}</label>
          
          <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '4px', 
              marginBottom: '0' 
          }}>
            {decedentList.map((item, index) => (
              <button
                key={index}
                onClick={() => setActiveDecedentIndex(index)}
                style={{
                  padding: '10px 20px',
                  background: activeDecedentIndex === index ? '#162032' : '#1e293b',
                  color: activeDecedentIndex === index ? '#3b82f6' : '#94a3b8',
                  border: '1px solid #334155',
                  borderBottom: activeDecedentIndex === index ? 'none' : '1px solid #334155',
                  borderRadius: '8px 8px 0 0',
                  cursor: 'pointer',
                  fontWeight: activeDecedentIndex === index ? 'bold' : 'normal',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  zIndex: activeDecedentIndex === index ? 2 : 1,
                  position: 'relative',
                  top: activeDecedentIndex === index ? '1px' : '0'
                }}
              >
                <i className="fas fa-user" style={{ fontSize: '0.8rem', opacity: 0.7 }}></i>
                {(item?.decedentName && item?.decedentOOC) 
                  ? `${item.decedentName} - ${item.decedentOOC}` 
                  : (item?.decedentName || item?.decedentOOC || `Decedent #${index + 1}`)}
              </button>
            ))}
            <button
              onClick={addDecedent}
              style={{
                padding: '10px 15px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                fontSize: '0.9rem',
                marginLeft: '4px',
                transition: 'background 0.2s'
              }}
              title="Add Decedent"
            >
              <i className="fas fa-plus"></i>
            </button>
          </div>

          {decedentList.length > 0 ? (
            <DecedentItemRenderer
              key={activeDecedentIndex}
              itemValues={decedentList[activeDecedentIndex]}
              itemSchema={currentDecedentItemSchema}
              onItemChange={(subFieldName, subFieldValue) => handleDecedentItemChange(activeDecedentIndex, subFieldName, subFieldValue)}
              onRemove={() => removeDecedent(activeDecedentIndex)}
              index={activeDecedentIndex}
              parentFieldName={field.name}
              finalSelectOptions={finalSelectOptions}
              currentUtcTime={currentUtcTime}
              agencyDataStore={agencyDataStore}
              showNotification={showNotification}
              setShowMapModal={setShowMapModal}
              setMapTargetField={setMapTargetField}
              isUploadingMapImage={isUploadingMapImage}
            />
          ) : (
            <div style={{ 
                padding: '3rem', 
                background: '#162032', 
                borderRadius: 8, 
                border: '2px dashed #334155', 
                textAlign: 'center',
                color: '#94a3b8'
            }}>
                <i className="fas fa-users-slash" style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }}></i>
                <p>No decedents added yet.</p>
                <button onClick={addDecedent} className="btn btn-success">
                    <i className="fas fa-plus"></i> Add First Decedent
                </button>
            </div>
          )}
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
                        Diagram URL: <span 
                            onClick={() => openImagePreview(formValues[field.name])}
                            style={{ color: '#34d399', textDecoration: 'underline', cursor: 'pointer' }}
                        >View Diagram</span>
                    </div>
                )}


                <AutopsyDiagramModal
                    show={showModal}
                    onHide={() => setShowModal(false)}
                    onSaveDiagram={(markers, imageUrl, summaries) => {
                        handleChange(field.name, imageUrl); // Save the image URL
                        handleChange(`${field.name}_markers`, markers); // Save the markers data
                        
                        if (summaries && summaries.length > 0 && selectedForm && selectedForm.fields) {
                            // Find the anatomic summary field in the form schema
                            const summaryField = selectedForm.fields.find(f => 
                                f.name === 'anatomicSummaryListItems' || 
                                (f.label && f.label.toLowerCase().includes('anatomic summary'))
                            );
                            
                            if (summaryField) {
                                // If there are existing items, we might want to append, but usually diagram is the source of truth for these.
                                // Let's check if there are already items.
                                const existingItems = Array.isArray(formValues[summaryField.name]) ? formValues[summaryField.name] : [];
                                
                                // To avoid duplicates and keep manual entries, we could do something more complex, 
                                // but for now, let's just append the new summaries if they aren't already there.
                                const newItems = [...existingItems];
                                summaries.forEach(summary => {
                                    if (!newItems.includes(summary)) {
                                        newItems.push(summary);
                                    }
                                });
                                
                                handleChange(summaryField.name, newItems);
                            }
                        }
                        
                        setShowModal(false);
                    }}
                    initialMarkers={initialMarkers}
                    initialSummaries={(() => {
                        const summaryField = selectedForm?.fields?.find(f => 
                            f.name === 'anatomicSummaryListItems' || 
                            (f.label && f.label.toLowerCase().includes('anatomic summary'))
                        );
                        return Array.isArray(formValues[summaryField?.name]) ? formValues[summaryField.name] : [];
                    })()}
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
    case "medicine_block":
      return (
        <div style={{ ...fieldWrapperStyle, padding: '1rem', border: '1px solid #334155', borderRadius: '8px', background: '#162032' }}>
          <h5 style={{ color: '#a78bfa', marginBottom: '1rem' }}>{field.label}  </h5>
          You MUST document the medicines prescribed and upload proof of prescription images. Failure to do so may result in disciplinary action. 
          
          <label style={{ ...labelStyle, fontSize: '0.9rem' }}>Medicine Prescribed</label>
          <textarea
            name={`${field.name}_prescribed`}
            rows={field.rows || 4}
            value={(formValues[field.name] && formValues[field.name].prescribed) || ''}
            onChange={e => {
              const currentVal = formValues[field.name];
              const prescribed = e.target.value;
              const proof = (currentVal && typeof currentVal === 'object' && currentVal.proof) || [];
              handleChange(field.name, { prescribed, proof });
            }}
            placeholder="List the medicines prescribed..."
            style={{ ...inputStyle, marginBottom: '1rem' }}
          />

          <label style={{ ...labelStyle, fontSize: '0.9rem' }}>Proof of Prescription (Images)</label>
          <ImageUploader
            images={(formValues[field.name] && formValues[field.name].proof) || []}
            onImagesChange={(newImages) => {
              const currentVal = formValues[field.name];
              const prescribed = (currentVal && typeof currentVal === 'object' && currentVal.prescribed) || '';
              handleChange(field.name, { prescribed, proof: newImages });
            }}
            maxImages={field.maxImages || 6}
            fieldName={`${field.name}_proof`}
          />
        </div>
      );
    case "input":
    default:
      return (
        <div 
          data-tour-id={field.id} 
          data-tour-name={field.name}
          data-tour-type={field.type}
          style={{ ...fieldWrapperStyle, display: "inline-block" }}
        >
          <label style={labelStyle}>{field.label}</label>
          {formValues[`${field.name}_isFromMap`] && (
            <div style={{ fontSize: '0.75rem', color: '#34d399', marginBottom: '0.4rem' }}>
              USING MAP MARKER
            </div>
          )}
          <input
            type="text"
            value={formValues[`${field.name}_display`] || formValues[field.name] || ""}
            onChange={e => handleChange(field.name, e.target.value)} // Keep original field.name for BBCode generation
            placeholder={field.placeholder || ""}
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
            {field.name === 'placeOfDeath' && !isUploadingMapImage[field.name] && !formValues[`${field.name}_isFromMap`] && (
              <button
                onClick={() => {
                  setMapTargetField('placeOfDeath');
                  setShowMapModal(true);
                }}
                className="btn btn-sm btn-info"
                style={{ flex: 1 }}
              >
                <i className="fas fa-map-marked-alt"></i> Select from Map
              </button>
            )}
            {field.name === 'placeOfDeath' && formValues[`${field.name}_isFromMap`] && (
              <button
                onClick={() => {
                  handleChange('placeOfDeath_isFromMap', false);
                  handleChange('placeOfDeath_display', '');
                  handleChange('placeOfDeath', formValues.placeOfDeath_display || ''); // Set BBCode to current display value
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
  }
};

export default FormFieldRenderer;