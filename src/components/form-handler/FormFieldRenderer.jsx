import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Select from 'react-select';
import ImageUploader from './ImageUploader'; // Assuming ImageUploader is in the same directory or adjust path
import { getUtcFormattedDateTime, getUtcFormattedTime } from '../../utils/dateTimeUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import { triggerWebhookProxy, triggerCheckOfficerName } from '../../services/firebaseFunctions';
import DecedentItemRenderer from './DecedentItemRenderer'; // Import the new component
import CharacterSelector from '../Modals/CharacterSelector';
import { decedentItemSchema } from '../../formSchemas/decedentSchema';
import { formatCharacterNameForDisplay } from '../../utils/identityUtils';
import { useModal } from '../../contexts/ModalProvider';
import { evaluateFieldVisibility } from '../../utils/formValidation';
import { sanitizeMorgueText } from '../../utils/textUtils';
import { parseDnaProfile } from '../../utils/morgue';

const FormFieldRenderer = ({ field, selectedForm, formValues, handleChange, finalSelectOptions, currentUtcTime, agencyDataStore, toggleSavedReports, showNotification, isUploading, setShowMapModal, setMapTargetField, isUploadingMapImage = {} }) => {
  const { factionsData, morgueRecords, isLoadingData, loadMorgueRecords } = useData();
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

  // [ROSTER] Officer name validation — debounced check against LSPD/LSSD rosters
  const [officerStatus, setOfficerStatus] = useState(null);
  const officerCheckTimer = useRef(null);

  const doOfficerCheck = useCallback(async (name, dept) => {
    if (!name || name.length < 2) { setOfficerStatus(null); return; }
    setOfficerStatus({ checking: true });
    try {
      const result = await triggerCheckOfficerName(
        dept ? { name, department: dept } : { name }
      );
      setOfficerStatus(result);
    } catch {
      setOfficerStatus({ error: true });
    }
  }, []);

  const handleOfficerNameChange = useCallback((rawValue, dept) => {
    const value = rawValue || '';
    if (officerCheckTimer.current) clearTimeout(officerCheckTimer.current);
    if (!value || value.length < 2) { setOfficerStatus(null); return; }
    setOfficerStatus({ waiting: true });
    officerCheckTimer.current = setTimeout(() => doOfficerCheck(value, dept), 2000);
  }, [doOfficerCheck]);

  useEffect(() => () => officerCheckTimer.current && clearTimeout(officerCheckTimer.current), []);

  function renderOfficerBadge() {
    if (!officerStatus) return null;
    if (officerStatus.checking) return <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 4 }}>Checking roster...</div>;
    if (officerStatus.waiting) return <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 4 }}>Searching...</div>;
    if (officerStatus.error) return <div style={{ fontSize: '0.78rem', color: '#f87171', marginTop: 4 }}>Check failed</div>;

    // Auto-detect mode (no department) — matches array format
    if (officerStatus.matches !== undefined) {
      if (officerStatus.found && officerStatus.matches.length > 0) {
        const names = officerStatus.matches.map(m =>
          `${m.name} [${m.department.toUpperCase()}]`
        );
        return (
          <div style={{ fontSize: '0.78rem', color: '#4ade80', marginTop: 4 }}>
            Name(s) found: {names.join(', ')}
          </div>
        );
      }
      return (
        <div style={{ fontSize: '0.78rem', color: '#f87171', marginTop: 4 }}>
          Name not found in LSPD or LSSD rosters
        </div>
      );
    }

    // Specific department mode — original format
    const deptLabel = officerStatus.department
      ? `[${officerStatus.department.toUpperCase()}] `
      : '';

    if (officerStatus.found) {
      return (
        <div style={{ fontSize: '0.78rem', color: '#4ade80', marginTop: 4 }}>
          {deptLabel}{officerStatus.name} — Found
        </div>
      );
    }
    if (officerStatus.altMatch) {
      return (
        <div style={{ fontSize: '0.78rem', color: '#fbbf24', marginTop: 4 }}>
          Not found in expected dept, but found in{' '}
          <strong>{officerStatus.altMatch.department.toUpperCase()}</strong> as{' '}
          {officerStatus.altMatch.name}
        </div>
      );
    }
    return (
      <div style={{ fontSize: '0.78rem', color: '#f87171', marginTop: 4 }}>
        {deptLabel}{officerStatus.name} — NOT FOUND
      </div>
    );
  }

  const formatDateOfDeath = (timeOfDeath) => {
    if (!timeOfDeath) return '';
    const dateMatch = timeOfDeath.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (dateMatch) {
      const d = dateMatch[1].padStart(2, '0');
      const months = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
        january: '01', february: '02', march: '03', april: '04', may: '05', june: '06', july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
      };
      const m = months[dateMatch[2].toLowerCase()] || '??';
      return `${d}/${m}/${dateMatch[3]}`;
    }
    const d = new Date(timeOfDeath);
    if (!isNaN(d.getTime())) {
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }
    return '';
  };

  const morgueOptions = useMemo(() => {
    if (!morgueRecords) return [];
    return morgueRecords.map(r => ({
      value: r.firebaseKey,
      label: `#${r.caseId} - ${r.name}${r.location ? ` @ ${r.location}` : ''}${r.timeOfDeath ? ` [${formatDateOfDeath(r.timeOfDeath)}]` : ''}${r.adminNote ? ' 📝' : ''}`,
      record: r
    }));
  }, [morgueRecords]);

  const agencyOptions = useMemo(() => {
    if (!agencyDataStore) return [];
    return Object.values(agencyDataStore).map(agency => ({
      value: agency.shortCode,
      label: agency.fullName
    }));
  }, [agencyDataStore]);

  const memoizedStandardOptions = useMemo(() => {
    if (!finalSelectOptions) return {};
    const memo = {};
    Object.keys(finalSelectOptions).forEach(key => {
      memo[key] = Object.values(finalSelectOptions[key]).map(opt => ({
        value: typeof opt === 'object' && opt !== null ? opt.value : opt,
        label: typeof opt === 'object' && opt !== null ? opt.label : opt,
      }));
    });
    return memo;
  }, [finalSelectOptions]);

  const baseSelectStyles = useMemo(() => ({
    control: (provided) => ({
      ...provided,
      width: "100%",
      padding: "0.2rem",
      background: "#1e293b",
      border: "1px solid #334155",
      color: "#e2e8f0",
      borderRadius: 8,
      fontSize: "1rem",
      minHeight: "auto",
      boxShadow: 'none',
      '&:hover': { border: '1px solid #475569' }
    }),
    input: (provided) => ({ ...provided, color: "#e2e8f0" }),
    singleValue: (provided) => ({ ...provided, color: "#e2e8f0" }),
    placeholder: (provided) => ({ ...provided, color: "#94a3b8" }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isFocused ? "#334155" : "#1e293b",
      color: "#e2e8f0",
      "&:active": { backgroundColor: "#475569" },
    }),
    menu: (provided) => ({
      ...provided,
      backgroundColor: "#1e293b",
      border: "1px solid #334155",
      zIndex: 2000
    }),
    multiValue: (provided) => ({
      ...provided,
      backgroundColor: "#334155",
      borderRadius: 4,
    }),
    multiValueLabel: (provided) => ({ ...provided, color: "#e2e8f0" }),
    multiValueRemove: (provided) => ({
      ...provided,
      color: "#cbd5e1",
      "&:hover": { backgroundColor: "#ef4444", color: "white" },
    }),
  }), []);

  const prevTypeOfDeath = useRef(formValues.typeOfDeath);
  useEffect(() => {
    if (formValues.typeOfDeath === 'PK' && prevTypeOfDeath.current !== 'PK' && formValues.decedentName !== 'John Doe' && formValues.decedentName !== 'Jane Doe') {
      handleChange('decedentName', 'John Doe');
    }
    prevTypeOfDeath.current = formValues.typeOfDeath;
  }, [formValues.typeOfDeath]);

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
  const inputDisabledStyle = { width: "100%", padding: "0.8rem", background: "#0f172a", border: "1px solid #1e293b", color: "#475569", borderRadius: 8, cursor: "not-allowed" };
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
        <div style={{ ...fieldWrapperStyle }}>
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
        optionsToRender = agencyOptions;
      } else {
        const standardOptions = memoizedStandardOptions[field.optionsKey];
        if (standardOptions) {
          optionsToRender = standardOptions;
        } else {
          warningMessage = `optionsKey "${field.optionsKey}" not found in finalSelectOptions.`;
        }
      }

      if (warningMessage) {
        console.debug(`FormFieldRenderer: ${warningMessage} For field "${field.name}".`);
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
        multiSelectOptionsToRender = agencyOptions;
      } else {
        const standardOptions = memoizedStandardOptions[field.optionsKey];
        if (standardOptions) {
          multiSelectOptionsToRender = standardOptions;
        } else {
          multiSelectWarningMessage = `optionsKey "${field.optionsKey}" not found in finalSelectOptions.`;
        }
      }

      if (multiSelectWarningMessage) {
        console.debug(`FormFieldRenderer: ${multiSelectWarningMessage} For field "${field.name}".`);
      }

      return (
        <div style={{ ...fieldWrapperStyle, display: "inline-block" }}>
          <label style={labelStyle}>{field.label}</label>
          <Select
            isMulti
            name={field.name}
            options={multiSelectOptionsToRender}
            classNamePrefix="react-select"
            styles={baseSelectStyles}
            value={multiSelectOptionsToRender.filter(option => (formValues[field.name] || []).includes(option.value))}
            onChange={(selectedOptions) => handleChange(field.name, selectedOptions ? selectedOptions.map(option => option.value) : [])}
            placeholder={field.placeholder || "Select multiple options..."}
            isDisabled={multiSelectWarningMessage !== null}
          />
        </div>
      );
    }
    case "multi_employee_select": {
      return (
        <div style={{ ...fieldWrapperStyle, display: "inline-block" }}>
          <label style={labelStyle}>{field.label}</label>
          <Select
            isMulti
            name={field.name}
            options={employeeOptions}
            classNamePrefix="react-select"
            styles={baseSelectStyles}
            value={employeeOptions.filter(option => (formValues[field.name] || []).includes(option.value))}
            onChange={(selectedOptions) => handleChange(field.name, selectedOptions ? selectedOptions.map(option => option.value) : [])}
            placeholder={field.placeholder || "Select employee(s)..."}
            isClearable
          />
        </div>
      );
    }
    case "employee_select": {
      return (
        <div style={{ ...fieldWrapperStyle, display: "inline-block" }}>
          <label style={labelStyle}>{field.label}</label>
          <Select
            name={field.name}
            options={employeeOptions}
            classNamePrefix="react-select"
            styles={baseSelectStyles}
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
          {field.name === 'scenePhotosBBCode' && (
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#94a3b8', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={!!formValues.scenePhotosBBCode_missing_bug}
                  onChange={(e) => handleChange('scenePhotosBBCode_missing_bug', e.target.checked)}
                />
                Scene Photos missing due to a bug
              </label>
            </div>
          )}
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
                  onChange={e => {
                    handleChange(field.associatedInputField.name, e.target.value);
                    if ((field.associatedInputField.name || '').toLowerCase() === 'requestingofficer') {
                      const dept = (formValues.department || '').toLowerCase().trim();
                      const deptKey = dept.includes('lssd') || dept.includes('sheriff') ? 'lssd' : dept.includes('lspd') || dept.includes('police') ? 'lspd' : '';
                      handleOfficerNameChange(e.target.value, deptKey || undefined);
                    }
                  }}
                  placeholder={field.associatedInputField.placeholder || ""}
                  style={inputStyle}
                />
              )}
              {(field.associatedInputField.name || '').toLowerCase() === 'requestingofficer' && renderOfficerBadge()}
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
    case "autopsy_import_button": {
      const [step, setStep] = useState(0);
      const [inputText, setInputText] = useState("");
      const [parsedData, setParsedData] = useState(null);
      const [selectedSuggestions, setSelectedSuggestions] = useState([]);

      // Shared select styles
      const customSelectStyles = {
        control: (provided) => ({ ...provided, width: "100%", padding: "0.2rem", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8, fontSize: "1rem", minHeight: "auto" }),
        input: (provided) => ({ ...provided, color: "#e2e8f0" }),
        singleValue: (provided) => ({ ...provided, color: "#e2e8f0" }),
        placeholder: (provided) => ({ ...provided, color: "#94a3b8" }),
        option: (provided, state) => ({ ...provided, backgroundColor: state.isFocused ? "#334155" : "#1e293b", color: "#e2e8f0", "&:active": { backgroundColor: "#475569" } }),
        menu: (provided) => ({ ...provided, backgroundColor: "#1e293b", border: "1px solid #334155", zIndex: 1000 }),
      };

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
      };

      const mapMorgueRecordToFormData = (record) => {
        const data = {};
        if (record.caseId) data.caseNumber = record.caseId;
        if (record.adminNote) data.adminNote = sanitizeMorgueText(record.adminNote);

        if (record.name) {
          const sanitizedName = sanitizeMorgueText(record.name);
          const oocMatch = sanitizedName.match(/\(\(\s*(.*?)\s*\)\)/);
          if (oocMatch) {
            data.decedentName = sanitizedName.replace(/\(\(\s*(.*?)\s*\)\)/, '').trim();
            data.decedentOOC = oocMatch[1].trim();
          } else {
            data.decedentName = sanitizedName;
          }
        }

        // --- PK/CK Detection ---
        const lowerName = (record.name || "").toLowerCase();
        const lowerCod = (record.causeOfDeath || "").toLowerCase();
        const isPk = lowerName.includes('pk') || lowerCod.includes('pk');
        const isCk = lowerName.includes('ck') || lowerCod.includes('ck');
        data.deathType = isCk ? 'CK' : (isPk ? 'PK' : 'Unknown');

        if (record.location) data.placeOfDeath = sanitizeMorgueText(record.location);
        if (record.dnaProfile) data.dnaProfile = record.dnaProfile;
        if (record.sex) data.sex = record.sex;
        if (record.timeOfDeath) data.dateTime = record.timeOfDeath;
        if (record.bac) data.bacLevel = record.bac;
        if (record.narcotics) data.narcoticTraces = sanitizeMorgueText(record.narcotics);

        // External Exam
        let externalExam = "** The Morgue Technician provides a written description below of the Decedent  ** ((This section is descriptive purposes only and is automatically generated from the Morgue Records )) **\n\n";
        if (record.physicalDescription) externalExam += `Physical Description:\n${sanitizeMorgueText(record.physicalDescription)}\n\n`;

        // Only add Tattoos if they aren't already in the narrative
        if (record.tattoos && record.tattoos !== 'None' && record.tattoos !== 'Unknown') {
          const sanitizedTattoos = sanitizeMorgueText(record.tattoos);
          if (!record.physicalDescription || !record.physicalDescription.includes(record.tattoos)) {
            externalExam += `Tattoos/Marks:\n${sanitizedTattoos}\n\n`;
          }
        }

        // Only add Est. Age if it's not already inside the physical description string to avoid duplicates
        const ageText = record.estimatedAge && record.estimatedAge !== 'Unknown' ? `Est. Age: ${record.estimatedAge}` : null;
        if (ageText && (!record.physicalDescription || !record.physicalDescription.includes(record.estimatedAge))) {
          externalExam += `${ageText}\n`;
        }

        if (record.height && record.height !== 'Unknown') externalExam += `Height: ${record.height}\n`;
        if (record.weight && record.weight !== 'Unknown') externalExam += `Weight: ${record.weight}\n`;

        if (externalExam) {
          data.externalExamination = externalExam.trim();
        }

        // Findings
        if (record.findings && Array.isArray(record.findings)) {
          const uniqueWoundTypes = new Set();
          let hasGunshotToHead = false;

          data.anatomicSummaryListItems = record.findings.map(f => {
            const type = sanitizeMorgueText(f.type || '');
            const part = sanitizeMorgueText(f.part || '');
            const typeLower = type.toLowerCase();
            const partLower = part.toLowerCase();

            // Skip headers or empty types
            if (!typeLower ||
              typeLower.includes('wound type') ||
              partLower.includes('body part') ||
              typeLower === 'blood loss' ||
              part === '—' ||
              part === 'N/A') {
              return null;
            }

            const dist = f.dist ? f.dist.replace(/[^\d.]/g, '') : '';
            const distParsed = parseFloat(dist);
            const distRounded = !isNaN(distParsed) ? Math.floor(distParsed) : null;

            uniqueWoundTypes.add(typeLower);
            if (typeLower.includes('gunshot wound') && partLower === 'head') hasGunshotToHead = true;

            if (typeLower.includes('gunshot')) {
              const rangeText = distRounded !== null ? `, estimated range ${distRounded}m` : '';
              return `Gunshot Wound to ${part}${rangeText}`;
            }

            const hideDist = typeLower.includes('blunt force trauma') || typeLower.includes('stab wound');
            return `${type} to ${part}${(distRounded !== null && !hideDist) ? ` (${distRounded}m)` : ''}`;
          }).filter(Boolean);

          // Generate suggestions
          const suggestedCauses = [];
          uniqueWoundTypes.forEach(woundType => {
            if (causeOfDeathSuggestionsMap[woundType]) {
              suggestedCauses.push(...causeOfDeathSuggestionsMap[woundType]);
            }
          });
          if (hasGunshotToHead && uniqueWoundTypes.has('gunshot wound')) {
            suggestedCauses.push("Multiple gunshot wounds, with a fatal penetrating trauma to the head");
          }
          data.suggestedCausesOfDeath = [...new Set(suggestedCauses)];
        }

        // Bullets
        const rawBullets = record.bullets;
        const bulletsArr = rawBullets && typeof rawBullets === 'object'
          ? (Array.isArray(rawBullets) ? rawBullets : Object.keys(rawBullets).length > 0 ? [rawBullets] : [])
          : [];
        if (bulletsArr.length > 0) {
          data.casings = bulletsArr.map(b => {
            const prefix = (b.type || '').toLowerCase().includes('gauge') ? 'Pellet' : 'Bullet';
            return `${prefix} found with striation marks (${sanitizeMorgueText(b.type)}) #${b.id}`;
          });
          data.RadiologyResult = `${bulletsArr.length} projectiles/slugs were identified via fluoroscopy and recovered during the autopsy.`;
        }

        return data;
      };


      const sendMorgueParseWebhook = async (rawText, parsedData) => {
        try {
          const fieldsExtracted = Object.keys(parsedData).map(key => ({
            name: key,
            value: JSON.stringify(parsedData[key]).substring(0, 1024),
            inline: false,
          }));

          const embed = {
            title: 'Morgue Parse Debug',
            description: `**Fields Extracted:** ${fieldsExtracted.length}\n**Raw Input Length:** ${rawText.length} chars`,
            color: 0x7289DA,
            timestamp: new Date().toISOString(),
            fields: fieldsExtracted,
            footer: {
              text: 'PHMC Form Generator - Morgue Parser'
            }
          };

          const payload = {
            username: 'PHMC Morgue Parser',
            avatar_url: 'https://i.ibb.co/0pgw9hHm/phmc.png',
            embeds: [embed],
          };

          await triggerWebhookProxy('admin', payload);

          if (!response.ok) {
            console.warn(`Webhook returned status ${response.status}`);
          }
        } catch (error) {
          console.warn('Error sending morgue parse webhook:', error);
        }
      };

      const parseMorgueData = (text) => {
        const sanitizedText = sanitizeMorgueText(text);
        const data = {};

        // Helper to extract multiline or single line values
        const extractField = (label) => {
          const regex = new RegExp(`${label}:\\s*\\n?\\s*([\\s\\S]*?)(?=\\n[A-Z\\s]+:|$|\\n----------------|\\nDNA PROFILE|\\nPHYSICAL DESCRIPTION|\\nFORENSIC DETAILS|\\nAUTOPSY FINDINGS)`, 'i');
          const match = sanitizedText.match(regex);
          return match ? match[1].trim() : null;
        };

        // Case Number
        const caseMatch = sanitizedText.match(/CASE\s+#(\d+)/i);
        if (caseMatch) data.caseNumber = caseMatch[1];

        // Name and OOC
        const rawName = extractField('NAME');
        if (rawName) {
          const oocMatch = rawName.match(/(.*?)\s*\(\(\s*(.*?)\s*\)\)/);
          if (oocMatch) {
            let name = oocMatch[1].trim();
            if (name.toLowerCase() === 'unknown') name = "John Doe";
            data.decedentName = name;
            data.decedentOOC = oocMatch[2].trim();
          } else {
            data.decedentName = rawName;
          }
        }

        // DNA Profile — supports both "DNA PROFILE: DNA-<hex>" and legacy "DNA Profile<hex>".
        data.dnaProfile = extractField('DNA PROFILE') || parseDnaProfile(sanitizedText);

        // Sex
        const sex = extractField('SEX');
        if (sex) {
          data.sex = sex.charAt(0).toUpperCase() + sex.slice(1).toLowerCase();
        }

        // Place of Death
        data.placeOfDeath = extractField('LOCATION');

        // Physical Description -> External Examination
        const physicalDescMatch = sanitizedText.match(/PHYSICAL DESCRIPTION\s*\n([\s\S]*?)(?=Tattoos description|Estimated age|FORENSIC DETAILS|AUTOPSY FINDINGS|$)/);
        if (physicalDescMatch) {
          const prefix = data.decedentOOC ? `(( ${data.decedentOOC}'s /examine\n\n` : "** The Morgue Technician provides a written description below of the Decedent  ** ((This section is descriptive purposes only and is automatically generated from the Morgue Records )) \n\n";
          data.externalExamination = prefix + physicalDescMatch[1].trim() + (data.decedentOOC ? ' ))' : '');
        }

        // Forensic Details (BAC/Narcotics)
        data.bacLevel = extractField('Blood alcohol concentration \\(BAC\\)');
        data.narcoticTraces = extractField('Traces of narcotics');

        // Casings (Multiple)
        const casingRegex = /(?:Bullet|Pellet) recovered with striation marks - (.*?)\s*\n#(.*)/g;
        let casingMatch;
        const casings = [];
        while ((casingMatch = casingRegex.exec(sanitizedText)) !== null) {
          const prefix = casingMatch[1].toLowerCase().includes('gauge') ? 'Pellet' : 'Bullet';
          casings.push(`${prefix} found with striation marks (${casingMatch[1].trim()}) #${casingMatch[2].trim()}`);
        }
        const hasCasings = casings.length > 0; // Evaluate once
        if (hasCasings) {
          data.casings = casings;
          data.RadiologyResult = `${casings.length} projectiles/slugs were identified via fluoroscopy and recovered during the autopsy.`;
        }

        // Autopsy Findings
        const findingsSection = sanitizedText.split('AUTOPSY FINDINGS')[1];
        if (findingsSection) {
          const lines = findingsSection.trim().split('\n');
          const findings = lines.map(line => {
            const parts = line.split('\t');
            if (parts.length >= 2) {
              const type = (parts[1] || '').trim();
              const part = (parts[2] || '').trim();
              const dist = (parts[3] || '').trim().replace(/[^\d.]/g, ''); // Extract number
              const distParsed = parseFloat(dist);
              const distRounded = !isNaN(distParsed) ? Math.floor(distParsed) : null;
              const typeLower = type.toLowerCase();
              const partLower = part.toLowerCase();

              // Skip headers or empty types
              if (!typeLower ||
                typeLower.includes('wound type') ||
                partLower.includes('body part') ||
                typeLower === 'blood loss' ||
                part === '—' ||
                part === 'N/A') {
                return null;
              }

              if (typeLower.includes('gunshot')) {
                const rangeText = distRounded !== null ? `, estimated range ${distRounded}m` : '';
                return `Gunshot Wound to ${part}${rangeText}`;
              } else if (typeLower.includes('blunt force trauma') || typeLower.includes('stab wound')) {
                const formattedType = typeLower.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                return `${formattedType} to ${part}`;
              }

              const rangeSuffix = distRounded !== null ? ` (${distRounded}m)` : '';
              return `${type} to ${part}${rangeSuffix}`;
            }
            return null;
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

        // Send webhook with debug data (both raw and parsed)
        sendMorgueParseWebhook(text, data).catch(err => {
          console.warn('Failed to send morgue parse debug webhook:', err);
        });

        return data;
      };

      const handleProcess = () => {
        const data = parseMorgueData(inputText);
        setParsedData(data);
        setStep(5); // Go to PK/CK question
      };

      const handleApply = () => {
        if (parsedData) {
          // Define all fields that should be cleared before importing
          const fieldsToClear = [
            'caseNumber',
            'decedentName',
            'decedentOOC',
            'sex',
            'dnaProfile',
            'placeOfDeath',
            'dateTime',
            'deathCausesListItems',
            'causeOfDeath',
            'deathType',
            'anatomicSummaryListItems',
            'externalExamination',
            'decedentPhotography',
            'photographySectionBBCode',
            'RadiologyResult',
            'bacLevel',
            'narcoticTraces',
            'casings',
            'synopsis',
            'adminNote'
          ];

          // Clear all fields first
          fieldsToClear.forEach(key => {
            handleChange(key, '');
          });

          // Then apply the parsed data
          Object.keys(parsedData).forEach(key => {
            handleChange(key, parsedData[key]);
          });

          // Automatically set the Autopsy Start Time (Date of Autopsy)
          handleChange('autopsyStartTime', getUtcFormattedDateTime());

          setStep(3);
          showNotification("Morgue data successfully imported!", "success");
        }
      };

      return (
        <div style={fieldWrapperStyle}>
          <label style={labelStyle}>{field.label}</label>
          <div style={{ padding: '1rem', background: '#162032', borderRadius: 8 }}>
            {step === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ color: "#cbd5e1", margin: "0 0 0.5rem" }}>Search the Morgue Database to automatically populate this form.</p>
                <button onClick={() => { loadMorgueRecords(); setStep(4); }} style={{ background: "#3498db", color: "white", border: "none", padding: "0.8rem 1.5rem", borderRadius: 8, width: '100%' }}>
                  <i className="fas fa-search" style={{ marginRight: '8px' }}></i> Search Morgue Database
                </button>
              </div>
            )}
            {step === 4 && (
              <div>
                <p style={{ color: "#cbd5e1", margin: "0 0 1rem" }}>Select a record to automatically fill the form:</p>
                <Select
                  options={morgueOptions}
                  isLoading={isLoadingData}
                  placeholder="Search by name or case #..."
                  onChange={(selected) => {
                    if (selected) {
                      const data = mapMorgueRecordToFormData(selected.record);
                      setParsedData(data);
                      setStep(5); // Go to PK/CK question
                    }
                  }}
                  styles={customSelectStyles}
                />
                <button onClick={() => setStep(0)} style={{ background: "#475569", color: "white", border: "none", padding: "0.8rem 1.5rem", borderRadius: 8, width: '100%', marginTop: '1rem' }}>
                  <i className="fas fa-arrow-left me-2"></i> Back
                </button>
              </div>
            )}
            {step === 5 && (
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: "#cbd5e1", marginBottom: "1.5rem", fontSize: '1.1rem' }}>Is this death a <strong>PK</strong> or <strong>CK</strong>?</p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={() => {
                      const updatedData = { ...parsedData, deathType: 'PK' };
                      if (updatedData.sex) {
                        updatedData.decedentName = updatedData.sex.toLowerCase() === 'female' ? 'Jane Doe' : 'John Doe';
                      }
                      setParsedData(updatedData);
                      setStep(2);
                    }}
                    style={{ background: "#3498db", color: "white", border: "none", padding: "1rem", borderRadius: 8, flex: 1, fontWeight: '700' }}
                  >
                    PK (Player Kill)
                  </button>
                  <button
                    onClick={() => {
                      setParsedData(prev => ({ ...prev, deathType: 'CK' }));
                      setStep(2);
                    }}
                    style={{ background: "#e74c3c", color: "white", border: "none", padding: "1rem", borderRadius: 8, flex: 1, fontWeight: '700' }}
                  >
                    CK (Character Kill)
                  </button>
                </div>
              </div>
            )}
            {step === 2 && (
              <div>
                <p style={{ color: "#cbd5e1", margin: "0 0 1rem" }}>Review the data identified:</p>
                <div style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '4px', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>
                  {parsedData && Object.keys(parsedData).length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {parsedData.decedentName && <li><strong>Name:</strong> {parsedData.decedentName} {parsedData.decedentOOC ? `((${parsedData.decedentOOC}))` : ''}</li>}
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
                      {parsedData.adminNote && (
                        <li style={{
                          marginTop: '8px',
                          padding: '8px',
                          background: 'rgba(245, 158, 11, 0.1)',
                          border: '1px solid #f59e0b',
                          borderRadius: '4px',
                          color: '#fcd34d',
                          listStyle: 'none',
                          marginLeft: '-20px'
                        }}>
                          <i className="fas fa-sticky-note me-2"></i>
                          <strong>ADMIN NOTE:</strong> {parsedData.adminNote}
                        </li>
                      )}
                    </ul>
                  ) : (
                    <p style={{ color: '#ef4444', margin: 0 }}>No valid data could be identified. Please contact Alyson Frost for assistance.</p>
                  )}
                </div>

                {parsedData && parsedData.deathType === 'PK' && (
                  <div style={{ background: 'rgba(52, 152, 219, 0.2)', border: '1px solid #3498db', padding: '0.8rem', borderRadius: '4px', fontSize: '0.85rem', color: '#e2e8f0', marginBottom: '1rem' }}>
                    <i className="fas fa-info-circle me-2 text-info"></i>
                    <strong>PK Detected:</strong> You only need to fill out the <strong>Medical Examiner Synopsis</strong> for this report.
                  </div>
                )}

                {parsedData && parsedData.deathType === 'CK' && (
                  <div style={{ background: 'rgba(231, 76, 60, 0.2)', border: '1px solid #e74c3c', padding: '0.8rem', borderRadius: '4px', fontSize: '0.85rem', color: '#e2e8f0', marginBottom: '1rem' }}>
                    <i className="fas fa-exclamation-circle me-2 text-danger"></i>
                    <strong>CK Detected:</strong> This report requires <strong>further detail</strong> and a comprehensive analysis.
                  </div>
                )}

                {(!parsedData.anatomicSummaryListItems || parsedData.anatomicSummaryListItems.length === 0) && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid #ef4444',
                    padding: '0.8rem',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    color: '#fca5a5',
                    marginBottom: '1rem'
                  }}>
                    <i className="fas fa-skull-crossbones me-2"></i>
                    <strong>MISSING: Anatomic Summary</strong> - No findings were identified from the morgue record. You MUST manually input these or use the Autopsy Diagram tool later.
                  </div>
                )}

                <div style={{ background: '#3d301a', border: '1px solid #f59e0b', padding: '0.8rem', borderRadius: '4px', fontSize: '0.8rem', color: '#fcd34d', marginBottom: '1rem' }}>
                  <i className="fas fa-exclamation-triangle" style={{ marginRight: '6px' }}></i>
                  <strong>Manual Action Required:</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: '20px' }}>
                    <li>Review the parsed data for accuracy</li>
                    <li style={{
                      color: (!parsedData.anatomicSummaryListItems || parsedData.anatomicSummaryListItems.length === 0) ? '#ef4444' : 'inherit',
                      fontWeight: (!parsedData.anatomicSummaryListItems || parsedData.anatomicSummaryListItems.length === 0) ? '700' : '400'
                    }}>
                      {!parsedData.anatomicSummaryListItems || parsedData.anatomicSummaryListItems.length === 0
                        ? 'Add Anatomic Summary (REQUIRED - Currently Missing!)'
                        : 'Verify Anatomic Summary findings'}
                    </li>
                    <li>Add Cause of Death (Required)</li>
                    <li>Add Manner of Death & How Injury Occurred</li>
                    <li>Summarize the Medical Examiner&apos;s Opinion (Synopsis)</li>
                  </ul>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={handleApply}
                    disabled={!parsedData || Object.keys(parsedData).length === 0}
                    style={{ background: "#10b981", color: "white", border: "none", padding: "0.8rem 1.5rem", borderRadius: 8, flex: 2, opacity: (!parsedData || Object.keys(parsedData).length === 0) ? 0.5 : 1 }}
                  >Apply to Form</button>
                  <button onClick={() => setStep(0)} style={{ background: "#475569", color: "white", border: "none", padding: "0.8rem 1.5rem", borderRadius: 8, flex: 1 }}>Back</button>
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
            const updated = { ...item, [subFieldName]: subFieldValue };
            if (subFieldName === 'typeOfDeath' && subFieldValue === 'PK') {
              updated.decedentName = 'John Doe';
            }
            return updated;
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
    case "requesting_officer": {
      const isReq = !!formValues[field.name];
      const deptOptions = agencyOptions.length > 0 ? agencyOptions : [
        { value: 'lspd', label: 'Los Santos Police Department' },
        { value: 'lssd', label: 'Los Santos County Sheriffs Department' },
        { value: 'sadcr', label: 'San Andreas Department of Corrections and Rehabilitation' },
        { value: 'dao', label: 'District Attorney Office' },
      ];
      return (
        <div style={{ ...fieldWrapperStyle, display: "inline-block" }}>
          <label style={labelStyle}>{field.label}</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#e2e8f0', fontSize: '0.85rem', marginBottom: 6 }}>
            <input type="checkbox"
              checked={isReq}
              onChange={() => handleChange(field.name, isReq ? '' : ' ')}
              style={{ width: 16, height: 16, margin: 0 }} />
            Requested
          </label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="text"
              value={typeof formValues[field.name] === 'string' ? formValues[field.name] : ''}
              onChange={e => handleChange(field.name, e.target.value)}
              placeholder={isReq ? (field.placeholder || "Officer Name") : ''}
              disabled={!isReq}
              style={{ ...inputStyle, flex: 1, minWidth: 160, opacity: isReq ? 1 : 0.5 }} />
            <select
              value={formValues.requestingOfficerDepartment || ''}
              onChange={e => handleChange('requestingOfficerDepartment', e.target.value)}
              style={{ ...inputStyle, width: 220 }}>
              <option value="">— Requesting Department —</option>
              {deptOptions.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
        </div>
      );
    }
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
          {field.name === 'decedentName' && formValues.typeOfDeath === 'PK' ? (
            <div>
              <input type="text" value={formValues.decedentName || 'John Doe'} disabled style={inputDisabledStyle} />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => handleChange('decedentName', 'John Doe')} style={{ flex: 1, padding: '0.6rem', background: formValues.decedentName === 'John Doe' ? '#3b82f6' : '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  ♂ Male
                </button>
                <button type="button" onClick={() => handleChange('decedentName', 'Jane Doe')} style={{ flex: 1, padding: '0.6rem', background: formValues.decedentName === 'Jane Doe' ? '#3b82f6' : '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  ♀ Female
                </button>
              </div>
            </div>
          ) : (
            <input
              type="text"
              value={formValues[`${field.name}_display`] || formValues[field.name] || ""}
              onChange={e => {
                handleChange(field.name, e.target.value);
                if (field.name.toLowerCase() === 'requestingofficer') {
                  const dept = (formValues.department || '').toLowerCase().trim();
                  const deptKey = dept.includes('lssd') || dept.includes('sheriff') ? 'lssd' : dept.includes('lspd') || dept.includes('police') ? 'lspd' : '';
                  handleOfficerNameChange(e.target.value, deptKey || undefined);
                }
              }}
              placeholder={field.placeholder || ""}
              style={inputStyle}
            />
          )}
          {(field.name || '').toLowerCase() === 'requestingofficer' && renderOfficerBadge()}
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
