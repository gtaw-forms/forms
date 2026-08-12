import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Select from 'react-select';
import ImageUploader from '../form-handler/ImageUploader';
import DecedentItemRenderer from '../form-handler/DecedentItemRenderer';
import CharacterSelector from '../Modals/CharacterSelector';
import TimeDisplay from './TimeDisplay';
import { decedentItemSchema } from '../../formSchemas/decedentSchema';
import { sanitizeMorgueText } from '../../utils/textUtils';
import { getUtcFormattedDateTime, getUtcFormattedTime } from '../../utils/dateTimeUtils';
import { formatCharacterNameForDisplay } from '../../utils/identityUtils';
import { triggerCheckOfficerName } from '../../services/firebaseFunctions';

// Debug logger — only logs when running the Vite dev server. Keeps the noisy
// per-render / per-keystroke officer-search logs out of the production bundle.
const devLog = (...args) => { if (import.meta.env.DEV) console.log(...args); };

/**
 * Standalone form field renderer for the UI prototype (/ui-prototype).
 * Uses testing-ui.css classes (`.field`, `.full`, `.input-with-btn`, etc.)
 * and CSS variables for styling — no production FormFieldRenderer dependency.
 */
const PrototypeFieldRenderer = ({
  field, value, onChange, allValues, onFieldChange,
  factionsData, morgueRecords, isLoadingData, loadMorgueRecords,
  showNotification, setShowMapModal, setMapTargetField,
  isUploadingMapImage, currentUtcTime, finalSelectOptions, agencyDataStore,
  toggleSavedReports, openImagePreview, isUploading,
}) => {

  /* ─── Helpers (defined before memoized options that use them) ─── */
  const formatDateOfDeath = (timeOfDeath) => {
    if (!timeOfDeath) return '';
    const dateMatch = timeOfDeath.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (dateMatch) {
      const d = dateMatch[1].padStart(2, '0');
      const months = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
        january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
        july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
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

  const getUtcCapture = (timerType) => {
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    switch (timerType) {
      case 'datetime-local': case 'dateTime':
        return `${now.getUTCFullYear()}-${pad(now.getUTCMonth()+1)}-${pad(now.getUTCDate())}T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
      case 'date': return `${now.getUTCFullYear()}-${pad(now.getUTCMonth()+1)}-${pad(now.getUTCDate())}`;
      case 'time': return `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
      default: return `${now.getUTCFullYear()}-${pad(now.getUTCMonth()+1)}-${pad(now.getUTCDate())}T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
    }
  };

  /* ─── Memoized Options ─── */
  const employeeOptions = useMemo(() => {
    if (!factionsData || !factionsData['364'] || !factionsData['364'].members) return [];
    return Object.values(factionsData['364'].members)
      .map(member => ({
        value: member.characterName,
        label: formatCharacterNameForDisplay(member.characterName),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [factionsData]);

  const agencyOptions = useMemo(() => {
    if (!agencyDataStore) return [];
    return Object.values(agencyDataStore).map(a => ({
      value: a.shortCode,
      label: a.fullName,
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

  const morgueOptions = useMemo(() => {
    if (!morgueRecords) return [];
    return morgueRecords.map(r => ({
      value: r.firebaseKey,
      label: `#${r.caseId} - ${r.name}${r.location ? ` @ ${r.location}` : ''}${r.timeOfDeath ? ` [${formatDateOfDeath(r.timeOfDeath)}]` : ''}${r.adminNote ? ' [NOTE]' : ''}`,
      record: r,
    }));
  }, [morgueRecords]);

  const baseSelectStyles = useMemo(() => ({
    control: (provided) => ({
      ...provided, width: '100%', padding: '0.2rem',
      background: '#182238', border: '1px solid #25324D',
      color: '#E7ECF5', borderRadius: 8, fontSize: '0.9rem',
      minHeight: 'auto', boxShadow: 'none',
      '&:hover': { border: '1px solid #324467' },
    }),
    input: (provided) => ({ ...provided, color: '#E7ECF5' }),
    singleValue: (provided) => ({ ...provided, color: '#E7ECF5' }),
    placeholder: (provided) => ({ ...provided, color: '#8B96AE' }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isFocused ? '#1E2A45' : '#182238',
      color: '#E7ECF5',
      '&:active': { backgroundColor: '#324467' },
    }),
    menu: (provided) => ({
      ...provided, backgroundColor: '#182238',
      border: '1px solid #25324D', zIndex: 2000,
    }),
    multiValue: (provided) => ({
      ...provided, backgroundColor: '#25324D', borderRadius: 4,
    }),
    multiValueLabel: (provided) => ({ ...provided, color: '#E7ECF5' }),
    multiValueRemove: (provided) => ({
      ...provided, color: '#8B96AE',
      '&:hover': { backgroundColor: '#E5566B', color: 'white' },
    }),
  }), []);

  /* ─── Effects ─── */
  // PK auto-fills decedentName to John/Jane Doe
  const prevTypeOfDeath = useRef(allValues.typeOfDeath);
  useEffect(() => {
    if (allValues.typeOfDeath === 'PK' && prevTypeOfDeath.current !== 'PK' && allValues.decedentName !== 'John Doe' && allValues.decedentName !== 'Jane Doe') {
      onFieldChange('decedentName', 'John Doe');
    }
    prevTypeOfDeath.current = allValues.typeOfDeath;
  }, [allValues.typeOfDeath]);

  /* =====================================================================
     FIELD TYPE HANDLERS
     ===================================================================== */

  switch (field.type) {

    /* ─── Section / Header ─── */
    case 'section':
    case 'small_header':
      return (
        <div className="field full">
          <div className="doc-eyebrow" style={{
            color: field.type === 'section' ? 'var(--teal)' : 'var(--text-faint)',
            fontSize: field.type === 'section' ? 13 : 11,
            marginBottom: 0,
          }}>
            {field.icon && <i className={`fas ${field.icon} me-2`} />}{field.label}
          </div>
        </div>
      );

    /* ─── Horizontal rules ─── */
    case 'hr':
    case 'fake_line':
      return (
        <div className="field full" style={{ padding: 0, margin: 0 }}>
          <hr style={{
            border: 'none',
            borderTop: `1px ${field.type === 'fake_line' ? 'dashed' : 'solid'} var(--border)`,
            margin: '0.5rem 0',
          }} />
        </div>
      );

    /* ─── Information state ─── */
    case 'information_state': {
      const infoStyle = field.infoType === 'Warning'
        ? { border: '1px solid var(--amber)', background: 'var(--amber-dim)', color: 'var(--amber)' }
        : field.infoType === 'Danger'
        ? { border: '1px solid var(--danger)', background: 'var(--danger-dim)', color: 'var(--danger)' }
        : { border: '1px solid var(--teal)', background: 'var(--teal-dim)', color: 'var(--teal)' };
      return (
        <div className="field full">
          <div style={{ borderRadius: 7, padding: '9px 12px', fontSize: 12.5, whiteSpace: 'pre-wrap', ...infoStyle }}>
            {field.content}
          </div>
        </div>
      );
    }

    /* ─── Timer ─── */
    case 'timer':
      return (
        <div className="field">
          <label>{field.label}</label>
          {field.displayCurrentTime && <TimeDisplay compact />}
          <div className="input-with-btn">
            <input type={field.timerType || 'text'} value={value || ''}
              onChange={e => onChange(e.target.value)} />
            {field.buttonLabel && (
              <button type="button" className="btn-inline"
                onClick={() => onChange(getUtcCapture(field.timerType))}>
                <i className="fas fa-clock me-1" style={{ fontSize: 11 }} />{field.buttonLabel}
              </button>
            )}
          </div>
        </div>
      );

    /* ─── Select ─── */
    case 'select': {
      let optionsToRender = [];
      let warningMessage = null;

      if (field.optionsKey === 'agencies') {
        optionsToRender = agencyOptions;
      } else if (field.optionsKey && memoizedStandardOptions[field.optionsKey]) {
        optionsToRender = memoizedStandardOptions[field.optionsKey];
      } else if (Array.isArray(field.options)) {
        optionsToRender = field.options.map(opt => ({
          value: typeof opt === 'object' ? opt.value : opt,
          label: typeof opt === 'object' ? opt.label : opt,
        }));
      } else if (field.optionsKey) {
        warningMessage = `optionsKey "${field.optionsKey}" not found.`;
      }

      return (
        <div className="field">
          <label>{field.label}</label>
          <select value={value || ''} onChange={e => onChange(e.target.value)}>
            <option value="">— Select —</option>
            {optionsToRender.length > 0 ? (
              optionsToRender.map((opt, i) => (
                <option key={i} value={opt.value}>{opt.label}</option>
              ))
            ) : (
              <option value="" disabled>{warningMessage || 'No options available'}</option>
            )}
          </select>
        </div>
      );
    }

    /* ─── Multi Select (react-select) ─── */
    case 'multi_select': {
      let multiOptions = [];
      let multiWarning = null;

      if (field.optionsKey === 'agencies') {
        multiOptions = agencyOptions;
      } else if (field.optionsKey && memoizedStandardOptions[field.optionsKey]) {
        multiOptions = memoizedStandardOptions[field.optionsKey];
      } else if (Array.isArray(field.options)) {
        multiOptions = field.options.map(opt => ({
          value: typeof opt === 'object' ? opt.value : opt,
          label: typeof opt === 'object' ? opt.label : opt,
        }));
      } else if (field.optionsKey) {
        multiWarning = `optionsKey "${field.optionsKey}" not found.`;
      }

      return (
        <div className="field">
          <label>{field.label}</label>
          <Select
            isMulti
            name={field.name}
            options={multiOptions}
            classNamePrefix="react-select"
            styles={baseSelectStyles}
            value={multiOptions.filter(opt => (value || []).includes(opt.value))}
            onChange={selected => onChange(selected ? selected.map(o => o.value) : [])}
            placeholder={field.placeholder || 'Select multiple options...'}
            isDisabled={multiWarning !== null}
          />
        </div>
      );
    }

    /* ─── Radio ─── */
    case 'radio':
      return (
        <div className="field">
          <label>{field.label}</label>
          <div style={{
            display: field.layout === 'compact' ? 'inline-flex' : 'flex',
            flexWrap: field.layout === 'compact' ? 'nowrap' : 'wrap',
            gap: '10px',
          }}>
            {(field.options || []).map(opt => (
              <label key={opt} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                cursor: 'pointer', color: 'var(--text)', fontSize: 13,
              }}>
                <input type="radio" name={field.name} value={opt}
                  checked={value === opt}
                  onChange={e => onChange(e.target.value)}
                  style={{ width: 16, height: 16, margin: 0 }} />
                {opt}
              </label>
            ))}
          </div>
        </div>
      );

    /* ─── Textarea ─── */
    case 'textarea': {
      const isCompact = field.layout === 'compact' || field.layout === 'compact-50';
      return (
        <div className={`field${isCompact ? '' : ' full'}`}>
          <label>{field.label}</label>
          <textarea value={value || ''} onChange={e => onChange(e.target.value)}
            placeholder={field.placeholder || ''} rows={field.rows || 4} />
        </div>
      );
    }

    /* ─── Input + Button Combo ─── */
    case 'input_button_combo':
      return (
        <div className="field" style={field.layout === 'compact' ? { flexDirection: 'row', alignItems: 'center', gap: 8 } : {}}>
          <label style={{ flexShrink: 0 }}>{field.label}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
            <input type={field.inputType || 'text'} value={value || ''}
              onChange={e => onChange(e.target.value)} />
            {field.buttonLabel && (
              <button type="button" className="btn-inline"
                onClick={() => {
                  if (field.buttonAction === 'set_current_time') {
                    onChange(field.inputType === 'datetime-local' ? getUtcFormattedDateTime() : getUtcFormattedTime());
                  }
                }}
                style={{ padding: '10px 14px', alignSelf: 'flex-start' }}>
                <i className="fas fa-clock me-1" />{field.buttonLabel}
              </button>
            )}
          </div>
        </div>
      );

    /* ─── Checkbox ─── */
    case 'checkbox': {
      // If this is the ReportRequested pattern, show a compound row:
      // checkbox + officer name input (conditional) + department dropdown (always visible)
      if (field.name === 'ReportRequested' && field.associatedInputField) {
        const deptOptions = agencyOptions.length > 0 ? agencyOptions : [
          { value: 'lspd', label: 'Los Santos Police Department' },
          { value: 'lssd', label: 'Los Santos County Sheriffs Department' },
          { value: 'sadcr', label: 'San Andreas Department of Corrections and Rehabilitation' },
          { value: 'dao', label: 'District Attorney Office' },
        ];
        return (
          <div className="field full">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12.5, color: 'var(--text)', marginBottom: 6 }}>
              <input type="checkbox" checked={!!value}
                onChange={e => onChange(e.target.checked)}
                style={{ width: 16, height: 16, margin: 0 }} />
              {field.label}
            </label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <OfficerSearch
                field={field.associatedInputField}
                value={allValues?.[field.associatedInputField.name] || ''}
                onChange={v => onFieldChange(field.associatedInputField.name, v)}
                allValues={allValues}
                onFieldChange={onFieldChange}
                agencyOptions={agencyOptions}
                noCheckbox
                hideDeptSelect
                hideLabel
                inline
                disabled={!value}
              />
              <select value={allValues?.department || ''}
                onChange={e => onFieldChange('department', e.target.value)}
                style={{
                  flex: '1 1 260px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  color: 'var(--text)', borderRadius: 8, padding: '10px 12px', fontSize: 13,
                }}>
                <option value="">— Requesting Department —</option>
                {deptOptions.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>
        );
      }

      // Standard checkbox with optional associated input
      return (
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', lineHeight: 1.4, paddingTop: 2 }}>
            <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)}
              style={{ width: 16, height: 16, margin: 0, flexShrink: 0 }} />
            {field.label}
          </label>
          {!!value && field.associatedInputField && (
            field.associatedInputField.type === 'select' && finalSelectOptions?.[field.associatedInputField.optionsKey] ? (
              <select value={allValues?.[field.associatedInputField.name] || ''}
                onChange={e => onFieldChange(field.associatedInputField.name, e.target.value)}>
                <option value="">— Select —</option>
                {Object.values(finalSelectOptions[field.associatedInputField.optionsKey]).map((opt, i) => {
                  const ov = typeof opt === 'object' ? opt.value : opt;
                  const ol = typeof opt === 'object' ? opt.label : opt;
                  return <option key={i} value={ov}>{ol}</option>;
                })}
              </select>
            ) : field.associatedInputField.type === 'textarea' ? (
              <textarea rows={field.associatedInputField.rows || 1}
                value={allValues?.[field.associatedInputField.name] || ''}
                onChange={e => onFieldChange(field.associatedInputField.name, e.target.value)}
                placeholder={field.associatedInputField.placeholder || ''} />
            ) : (
              <input type="text"
                value={allValues?.[field.associatedInputField.name] || ''}
                onChange={e => onFieldChange(field.associatedInputField.name, e.target.value)}
                placeholder={field.associatedInputField.placeholder || ''} />
            )
          )}
        </div>
      );
    }

    /* ─── Body Tampered (information header + checkbox + conditional reason) ─── */
    case 'body_tampered': {
      const btTicked = !!value;
      const btReasonKey = field.associatedInputField?.name || `${field.name || 'bodyTampered'}Reason`;
      const btReasonVal = allValues?.[btReasonKey] || '';
      const btReasonType = field.associatedInputField?.type || 'input';
      const btPlaceholder = field.associatedInputField?.placeholder || field.placeholder || 'Describe what was tampered with...';
      const btInfoStyle = field.infoType === 'Warning'
        ? { border: '1px solid var(--amber)', background: 'var(--amber-dim)', color: 'var(--amber)' }
        : field.infoType === 'Danger'
        ? { border: '1px solid var(--danger)', background: 'var(--danger-dim)', color: 'var(--danger)' }
        : { border: '1px solid var(--teal)', background: 'var(--teal-dim)', color: 'var(--teal)' };
      return (
        <div className="field full">
          {field.info && (
            <div style={{ borderRadius: 7, padding: '9px 12px', fontSize: 12.5, whiteSpace: 'pre-wrap', ...btInfoStyle }}>
              {field.info}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12.5, color: 'var(--text)', lineHeight: 1.4, margin: 0 }}>
              <input type="checkbox" checked={btTicked}
                onChange={e => onChange(e.target.checked)}
                style={{ width: 16, height: 16, margin: 0, flexShrink: 0 }} />
              {field.label}
            </label>
          </div>
          {btTicked && (
            btReasonType === 'textarea' ? (
              <textarea rows={field.associatedInputField?.rows || 2}
                value={btReasonVal}
                onChange={e => onFieldChange(btReasonKey, e.target.value)}
                placeholder={btPlaceholder} />
            ) : (
              <input type="text"
                value={btReasonVal}
                onChange={e => onFieldChange(btReasonKey, e.target.value)}
                placeholder={btPlaceholder} />
            )
          )}
        </div>
      );
    }

    /* ─── Image Uploader ─── */
    case 'image':
      return (
        <div className="field full">
          <label>{field.label}</label>
          {field.name === 'scenePhotosBBCode' && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, color: 'var(--text-muted)' }}>
                <input type="checkbox"
                  checked={!!allValues.scenePhotosBBCode_missing_bug}
                  onChange={e => onFieldChange('scenePhotosBBCode_missing_bug', e.target.checked)} />
                Scene Photos missing due to a bug
              </label>
            </div>
          )}
          <ImageUploader
            images={value || []}
            onImagesChange={newImages => onChange(newImages)}
            notes={allValues[`${field.name}_narrative`] || ''}
            onNotesChange={newNotes => onFieldChange(`${field.name}_narrative`, newNotes)}
            maxImages={field.maxImages || 6}
            fieldName={field.name}
          />
        </div>
      );

    /* ─── Employee Select (react-select single) ─── */
    case 'employee_select':
      return (
        <div className="field">
          <label>{field.label}</label>
          <Select
            name={field.name}
            options={employeeOptions}
            classNamePrefix="react-select"
            styles={baseSelectStyles}
            value={employeeOptions.find(o => o.value === value) || null}
            onChange={selected => onChange(selected ? selected.value : '')}
            placeholder={field.placeholder || 'Select an employee...'}
            isClearable
          />
        </div>
      );

    /* ─── Multi Employee Select (react-select multi) ─── */
    case 'multi_employee_select':
      return (
        <div className="field">
          <label>{field.label}</label>
          <Select
            isMulti
            name={field.name}
            options={employeeOptions}
            classNamePrefix="react-select"
            styles={baseSelectStyles}
            value={employeeOptions.filter(o => (value || []).includes(o.value))}
            onChange={selected => onChange(selected ? selected.map(o => o.value) : [])}
            placeholder={field.placeholder || 'Select employee(s)...'}
            isClearable
          />
        </div>
      );

    /* ─── Character Selector ─── */
    case 'character_selector':
      return (
        <div className="field">
          <label>{field.label}</label>
          <CharacterSelector
            label=""
            onCharacterSelect={char => onChange(char ? char.fullName : '')}
            forceDropdown
          />
        </div>
      );

    /* ─── Dynamic Text List ─── */
    case 'dynamic_text_list': {
      const listItems = Array.isArray(value) ? value : [];
      return (
        <div className="field full">
          <label>{field.label}</label>
          {listItems.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input type="text" value={item}
                onChange={e => {
                  const updated = listItems.map((it, i) => i === idx ? e.target.value : it);
                  onChange(updated);
                }}
                placeholder={`${field.label} Item ${idx + 1}`}
                style={{ flex: 1 }} />
              <button className="btn-inline" style={{ background: 'var(--danger-dim)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
                onClick={() => onChange(listItems.filter((_, i) => i !== idx))}>
                <i className="fas fa-times" />
              </button>
            </div>
          ))}
          <button className="btn btn-ghost" style={{ width: '100%' }}
            onClick={() => onChange([...listItems, ''])}>
            <i className="fas fa-plus me-1" />{field.buttonLabel || 'Add Item'}
          </button>
        </div>
      );
    }

    /* ─── Decedent List (Mass Fatality) ─── */
    case 'decedent_list': {
      const [activeDecedentIndex, setActiveDecedentIndex] = useState(0);
      const decedentList = value || [];

      useEffect(() => {
        if (decedentList.length > 0 && activeDecedentIndex >= decedentList.length) {
          setActiveDecedentIndex(decedentList.length - 1);
        }
      }, [decedentList.length, activeDecedentIndex]);

      const addDecedent = useCallback(() => {
        const newDecedent = decedentItemSchema.reduce((acc, subField) => {
          if (subField.type === 'image') acc[subField.name] = [];
          else if (subField.type !== 'section') acc[subField.name] = '';
          return acc;
        }, {});
        const newList = [...decedentList, newDecedent];
        onChange(newList);
        setActiveDecedentIndex(newList.length - 1);
      }, [decedentList, onChange]);

      const handleDecedentItemChange = useCallback((idx, subName, subVal) => {
        const updated = decedentList.map((item, i) => {
          if (i !== idx) return item;
          const mod = { ...item, [subName]: subVal };
          if (subName === 'typeOfDeath' && subVal === 'PK') mod.decedentName = 'John Doe';
          return mod;
        });
        onChange(updated);
      }, [decedentList, onChange]);

      const removeDecedent = useCallback((idx) => {
        const updated = decedentList.filter((_, i) => i !== idx);
        onChange(updated);
        if (idx <= activeDecedentIndex) {
          setActiveDecedentIndex(Math.max(0, activeDecedentIndex - 1));
        }
      }, [decedentList, onChange, activeDecedentIndex]);

      return (
        <div className="field full" style={{ marginTop: 8 }}>
          <label style={{ marginBottom: 8 }}>{field.label || 'Decedents'}</label>

          {/* Tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 0 }}>
            {decedentList.map((item, idx) => (
              <button key={idx}
                onClick={() => setActiveDecedentIndex(idx)}
                style={{
                  padding: '10px 20px',
                  background: activeDecedentIndex === idx ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                  color: activeDecedentIndex === idx ? 'var(--teal)' : 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  borderBottom: activeDecedentIndex === idx ? 'none' : '1px solid var(--border)',
                  borderRadius: '8px 8px 0 0',
                  cursor: 'pointer',
                  fontWeight: activeDecedentIndex === idx ? 700 : 400,
                  fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 8,
                  position: 'relative', top: '1px', zIndex: activeDecedentIndex === idx ? 2 : 1,
                }}>
                <i className="fas fa-user" style={{ fontSize: 11, opacity: 0.7 }} />
                {(item?.decedentName && item?.decedentOOC)
                  ? `${item.decedentName} - ${item.decedentOOC}`
                  : (item?.decedentName || item?.decedentOOC || `Decedent #${idx + 1}`)}
              </button>
            ))}
            <button onClick={addDecedent}
              style={{
                padding: '10px 15px', background: 'var(--teal)', color: '#ffffff',
                border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer',
                fontSize: 13, marginLeft: 4,
              }}>
              <i className="fas fa-plus" />
            </button>
          </div>

          {/* Active decedent editor */}
          {decedentList.length > 0 ? (
            <DecedentItemRenderer
              key={activeDecedentIndex}
              itemValues={decedentList[activeDecedentIndex]}
              itemSchema={decedentItemSchema}
              onItemChange={(subName, subVal) => handleDecedentItemChange(activeDecedentIndex, subName, subVal)}
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
              padding: '3rem', background: 'var(--bg-surface)', borderRadius: 8,
              border: '2px dashed var(--border)', textAlign: 'center',
              color: 'var(--text-muted)',
            }}>
              <i className="fas fa-users-slash" style={{ fontSize: '2rem', marginBottom: 12, opacity: 0.3 }} />
              <p style={{ margin: '0 0 12px' }}>No decedents added yet.</p>
              <button className="btn btn-primary" onClick={addDecedent}>
                <i className="fas fa-plus me-1" /> Add First Decedent
              </button>
            </div>
          )}
        </div>
      );
    }

    /* ─── Medicine Block ─── */
    case 'medicine_block': {
      const blockVal = value && typeof value === 'object' ? value : {};
      return (
        <div className="field full" style={{
          padding: '1rem', border: '1px solid var(--border)',
          borderRadius: 8, background: 'var(--bg-surface)',
        }}>
          <h5 style={{ color: 'var(--teal)', margin: '0 0 12px' }}>{field.label}</h5>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
            You MUST document the medicines prescribed and upload proof of prescription images. Failure to do so may result in disciplinary action.
          </div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Medicine Prescribed</label>
          <textarea
            value={blockVal.prescribed || ''}
            onChange={e => onChange({ prescribed: e.target.value, proof: blockVal.proof || [] })}
            rows={field.rows || 4}
            placeholder="List the medicines prescribed..."
            style={{ marginBottom: 16 }}
          />
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Proof of Prescription (Images)</label>
          <ImageUploader
            images={blockVal.proof || []}
            onImagesChange={newImages => onChange({ prescribed: blockVal.prescribed || '', proof: newImages })}
            maxImages={field.maxImages || 6}
            fieldName={`${field.name}_proof`}
          />
        </div>
      );
    }

    /* ─── Requesting Officer (compound with server-side lookup) ─── */
    case 'requesting_officer':
    case 'officer_info':
      return <OfficerSearch field={field} value={value} onChange={onChange} allValues={allValues} onFieldChange={onFieldChange} agencyOptions={agencyOptions} noCheckbox={field.type === 'officer_info'} />;

    /* ─── Attach Report Button ─── */
    case 'attach_report_button': {
      const extractMassFatalityOoc = (bbCode) => {
        if (!bbCode || typeof bbCode !== 'string') return [];
        const oocMatches = bbCode.match( /\(\(\s*([^)]+)\s*\)\)/g);
        if (!oocMatches) return [];
        return [...new Set(oocMatches
          .map(m => m.replace(/\(\(\s*|\s*\)\)/g, '').trim())
          .filter(name => {
            if (name.toLowerCase().startsWith('unknown')) return false;
            if (name === name.toUpperCase() && name.length > 1) return false;
            if (name.length < 2) return false;
            if (['FOR INTERNAL RECORDS', 'DO NOT USE THESE', 'THESE IMAGES ARE'].some(k => name.includes(k))) return false;
            if (name.split(' ').length > 4) return false;
            return true;
          })
        )];
      };

      const attachedReports = allValues.additionalReports || [];
      return (
        <div className="field full">
          <button className="btn btn-primary"
            onClick={() => toggleSavedReports?.(null, field.employeeType, null, field.targetField, true)}
            style={{ width: '100%', justifyContent: 'center' }}>
            <i className="fas fa-paperclip me-1" /> {field.label}
          </button>
          {attachedReports.length > 0 && (
            <div style={{ marginTop: 12, borderLeft: '3px solid var(--teal)', paddingLeft: 14 }}>
              <h4 style={{ margin: '0 0 8px', color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 600 }}>Attached Reports:</h4>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--teal)', fontSize: 13 }}>
                {attachedReports.map((report, idx) => {
                  let title = report.originalKey || `Attached Report ${idx + 1}`;
                  const isMF = report.formId && (
                    report.formId === 'mass-fatality' || report.formId === 'mass-ftality-test' ||
                    (typeof report.formId === 'string' && report.formId.toLowerCase().includes('mass'))
                  );
                  if (isMF && report.bbCode) {
                    const names = extractMassFatalityOoc(report.bbCode);
                    if (names.length > 0) title = `${report.originalKey} [${names.join(', ')}]`;
                  }
                  return <li key={idx}>{title}</li>;
                })}
              </ul>
            </div>
          )}
        </div>
      );
    }

    /* ─── Autopsy Import Button ─── */
    case 'autopsy_import_button': {
      const [step, setStep] = useState(0);
      const [inputText, setInputText] = useState('');
      const [parsedData, setParsedData] = useState(null);
      const [selectedSuggestions, setSelectedSuggestions] = useState([]);

      const customSelectStyles = {
        control: (provided) => ({ ...provided, width: '100%', padding: '0.2rem', background: '#182238', border: '1px solid #25324D', color: '#E7ECF5', borderRadius: 8, fontSize: '0.85rem', minHeight: 'auto' }),
        input: (provided) => ({ ...provided, color: '#E7ECF5' }),
        singleValue: (provided) => ({ ...provided, color: '#E7ECF5' }),
        placeholder: (provided) => ({ ...provided, color: '#8B96AE' }),
        option: (provided, state) => ({ ...provided, backgroundColor: state.isFocused ? '#1E2A45' : '#182238', color: '#E7ECF5', '&:active': { backgroundColor: '#324467' } }),
        menu: (provided) => ({ ...provided, backgroundColor: '#182238', border: '1px solid #25324D', zIndex: 1000 }),
      };

      useEffect(() => {
        if (parsedData?.suggestedCausesOfDeath) {
          setSelectedSuggestions(parsedData.suggestedCausesOfDeath);
        } else {
          setSelectedSuggestions([]);
        }
      }, [parsedData]);

      const causeOfDeathSuggestionsMap = {
        'gunshot wound': ['Massive blood loss due to gunshot wounds', 'Damage to vital organs by gunshot', 'Internal hemorrhage from gunshot wounds', 'Acute blood loss from gunshot wounds'],
        'stab wound': ['Exsanguination due to stab wounds', 'Damage to vital organs by stab wound', 'Internal hemorrhage from stab wounds'],
        'blunt force trauma': ['Massive internal bleeding from blunt force trauma', 'Traumatic brain injury', 'Damage to vital organs from blunt force trauma'],
      };

      const mapMorgueRecordToFormData = (record) => {
        const data = {};
        if (record.caseId) data.caseNumber = record.caseId;
        if (record.adminNote) data.adminNote = sanitizeMorgueText(record.adminNote);
        if (record.name) {
          const sn = sanitizeMorgueText(record.name);
          const ooc = sn.match(/\(\(\s*(.*?)\s*\)\)/);
          if (ooc) {
            data.decedentName = sn.replace(/\(\(\s*(.*?)\s*\)\)/, '').trim();
            data.decedentOOC = ooc[1].trim();
          } else {
            data.decedentName = sn;
          }
        }
        const lowerName = (record.name || '').toLowerCase();
        const lowerCod = (record.causeOfDeath || '').toLowerCase();
        const isPk = lowerName.includes('pk') || lowerCod.includes('pk');
        const isCk = lowerName.includes('ck') || lowerCod.includes('ck');
        data.deathType = isCk ? 'CK' : (isPk ? 'PK' : 'Unknown');
        if (record.location) data.placeOfDeath = sanitizeMorgueText(record.location);
        if (record.dnaProfile) data.dnaProfile = record.dnaProfile;
        if (record.sex) data.sex = record.sex;
        if (record.timeOfDeath) data.dateTime = record.timeOfDeath;
        if (record.bac) data.bacLevel = record.bac;
        if (record.narcotics) data.narcoticTraces = sanitizeMorgueText(record.narcotics);
        let ext = '** The Morgue Technician provides a written description below of the Decedent  ** ((This section is descriptive purposes only and is automatically generated from the Morgue Records )) **\n\n';
        if (record.physicalDescription) ext += `Physical Description:\n${sanitizeMorgueText(record.physicalDescription)}\n\n`;
        if (record.tattoos && record.tattoos !== 'None' && record.tattoos !== 'Unknown') {
          const st = sanitizeMorgueText(record.tattoos);
          if (!record.physicalDescription || !record.physicalDescription.includes(record.tattoos)) ext += `Tattoos/Marks:\n${st}\n\n`;
        }
        const ageText = record.estimatedAge && record.estimatedAge !== 'Unknown' ? `Est. Age: ${record.estimatedAge}` : null;
        if (ageText && (!record.physicalDescription || !record.physicalDescription.includes(record.estimatedAge))) ext += `${ageText}\n`;
        if (record.height && record.height !== 'Unknown') ext += `Height: ${record.height}\n`;
        if (record.weight && record.weight !== 'Unknown') ext += `Weight: ${record.weight}\n`;
        if (ext) data.externalExamination = ext.trim();
        if (record.findings && Array.isArray(record.findings)) {
          const uniqueWoundTypes = new Set();
          let hasGunshotToHead = false;
          data.anatomicSummaryListItems = record.findings.map(f => {
            const type = sanitizeMorgueText(f.type || '');
            const part = sanitizeMorgueText(f.part || '');
            const tl = type.toLowerCase();
            const pl = part.toLowerCase();
            if (!tl || tl.includes('wound type') || pl.includes('body part') || tl === 'blood loss' || part === '-' || part === 'N/A') return null;
            const dist = f.dist ? f.dist.replace(/[^\d.]/g, '') : '';
            const dp = parseFloat(dist);
            const dr = !isNaN(dp) ? Math.floor(dp) : null;
            uniqueWoundTypes.add(tl);
            if (tl.includes('gunshot wound') && pl === 'head') hasGunshotToHead = true;
            if (tl.includes('gunshot')) return `Gunshot Wound to ${part}${dr !== null ? `, estimated range ${dr}m` : ''}`;
            return `${type} to ${part}${(dr !== null && !tl.includes('blunt force trauma') && !tl.includes('stab wound')) ? ` (${dr}m)` : ''}`;
          }).filter(Boolean);
          const suggested = [];
          uniqueWoundTypes.forEach(wt => { if (causeOfDeathSuggestionsMap[wt]) suggested.push(...causeOfDeathSuggestionsMap[wt]); });
          if (hasGunshotToHead && uniqueWoundTypes.has('gunshot wound')) suggested.push('Multiple gunshot wounds, with a fatal penetrating trauma to the head');
          data.suggestedCausesOfDeath = [...new Set(suggested)];
        }
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

      const handleApply = () => {
        if (!parsedData) return;
        const fieldsToClear = [
          'caseNumber', 'decedentName', 'decedentOOC', 'sex', 'dnaProfile',
          'placeOfDeath', 'dateTime', 'deathCausesListItems', 'causeOfDeath',
          'deathType', 'anatomicSummaryListItems', 'externalExamination',
          'decedentPhotography', 'photographySectionBBCode', 'RadiologyResult',
          'bacLevel', 'narcoticTraces', 'casings', 'synopsis', 'adminNote',
        ];
        fieldsToClear.forEach(key => onFieldChange(key, ''));
        Object.keys(parsedData).forEach(key => onFieldChange(key, parsedData[key]));
        onFieldChange('autopsyStartTime', getUtcFormattedDateTime());
        setStep(3);
        showNotification?.('Morgue data successfully imported!', 'success');
      };

      return (
        <div className="field full">
          <label>{field.label}</label>
          <div style={{ padding: '1rem', background: 'var(--bg-surface)', borderRadius: 8 }}>
            {step === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ color: 'var(--text-muted)', margin: '0 0 0.5rem', fontSize: 13 }}>
                  Search the Morgue Database to automatically populate this form.
                </p>
                <button onClick={() => { loadMorgueRecords?.(); setStep(4); }}
                  className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  <i className="fas fa-search me-1" /> Search Morgue Database
                </button>
              </div>
            )}
            {step === 4 && (
              <div>
                <p style={{ color: 'var(--text-muted)', margin: '0 0 1rem', fontSize: 13 }}>Select a record to auto-fill:</p>
                <Select
                  options={morgueOptions}
                  isLoading={isLoadingData}
                  placeholder="Search by name or case #..."
                  onChange={(selected) => {
                    if (selected) {
                      setParsedData(mapMorgueRecordToFormData(selected.record));
                      setStep(5);
                    }
                  }}
                  styles={customSelectStyles}
                />
                <button onClick={() => setStep(0)} className="btn btn-ghost" style={{ width: '100%', marginTop: 12 }}>
                  <i className="fas fa-arrow-left me-1" /> Back
                </button>
              </div>
            )}
            {step === 5 && (
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: 'var(--text)', marginBottom: '1.5rem', fontSize: 14 }}>Is this death a <strong>PK</strong> or <strong>CK</strong>?</p>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button onClick={() => {
                    const d = { ...parsedData, deathType: 'PK' };
                    if (d.sex) d.decedentName = d.sex.toLowerCase() === 'female' ? 'Jane Doe' : 'John Doe';
                    setParsedData(d);
                    setStep(2);
                  }} className="btn" style={{ flex: 1, background: 'var(--teal)', color: '#ffffff' }}>
                    PK (Player Kill)
                  </button>
                  <button onClick={() => {
                    setParsedData(p => ({ ...p, deathType: 'CK' }));
                    setStep(2);
                  }} className="btn" style={{ flex: 1, background: 'var(--danger)', color: 'white' }}>
                    CK (Character Kill)
                  </button>
                </div>
              </div>
            )}
            {step === 2 && (
              <div>
                <p style={{ color: 'var(--text-muted)', margin: '0 0 1rem', fontSize: 13 }}>Review the data identified:</p>
                <div style={{ background: 'var(--bg-elevated)', padding: '0.8rem', borderRadius: 7, fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>
                  {parsedData && Object.keys(parsedData).length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {parsedData.decedentName && <li><strong>Name:</strong> {parsedData.decedentName}{parsedData.decedentOOC ? ` ((${parsedData.decedentOOC}))` : ''}</li>}
                      {parsedData.sex && <li><strong>Sex:</strong> {parsedData.sex}</li>}
                      {parsedData.dnaProfile && <li><strong>DNA:</strong> {parsedData.dnaProfile}</li>}
                      {parsedData.caseNumber && <li><strong>Case #:</strong> {parsedData.caseNumber}</li>}
                      {parsedData.placeOfDeath && <li><strong>Location:</strong> {parsedData.placeOfDeath}</li>}
                      {parsedData.dateTime && <li><strong>Time:</strong> {parsedData.dateTime}</li>}
                      {parsedData.bacLevel && <li><strong>BAC:</strong> {parsedData.bacLevel}</li>}
                      {parsedData.narcoticTraces && <li><strong>Narcotics:</strong> {parsedData.narcoticTraces}</li>}
                      {parsedData.externalExamination && <li><strong>External Exam:</strong> Extracted</li>}
                      {parsedData.casings && <li><strong>Casings:</strong> {parsedData.casings.length} found</li>}
                      {parsedData.anatomicSummaryListItems && <li><strong>Findings:</strong> {parsedData.anatomicSummaryListItems.length} items</li>}
                      {parsedData.adminNote && (
                        <li style={{ marginTop: 8, padding: 8, background: 'var(--amber-dim)', border: '1px solid var(--amber)', borderRadius: 6, color: 'var(--amber)', listStyle: 'none', marginLeft: '-20px' }}>
                          <i className="fas fa-sticky-note me-1" /><strong>ADMIN NOTE:</strong> {parsedData.adminNote}
                        </li>
                      )}
                    </ul>
                  ) : (
                    <p style={{ color: 'var(--danger)', margin: 0 }}>No valid data could be identified.</p>
                  )}
                </div>
                {parsedData?.deathType === 'PK' && (
                  <div className="notice-bubble notice-warn" style={{ marginBottom: 12 }}>
                    <span>i</span><span><strong>PK Detected:</strong> You only need to fill out the <strong>Medical Examiner Synopsis</strong> for this report.</span>
                  </div>
                )}
                {parsedData?.deathType === 'CK' && (
                  <div className="notice-bubble" style={{ background: 'var(--danger-dim)', color: 'var(--danger)', border: '1px solid var(--danger)', marginBottom: 12 }}>
                    <span>!</span><span><strong>CK Detected:</strong> This report requires <strong>further detail</strong> and a comprehensive analysis.</span>
                  </div>
                )}
                {(!parsedData?.anatomicSummaryListItems || parsedData.anatomicSummaryListItems.length === 0) && (
                  <div className="notice-bubble" style={{ background: 'var(--danger-dim)', color: 'var(--danger)', border: '1px solid var(--danger)', marginBottom: 12 }}>
                    <span>!</span><span><strong>MISSING: Anatomic Summary</strong> — No findings from the morgue record. You MUST manually input these.</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12 }}>
                  <button onClick={handleApply}
                    disabled={!parsedData || Object.keys(parsedData).length === 0}
                    className="btn" style={{
                      flex: 2, background: 'var(--teal)', color: '#ffffff',
                      opacity: (!parsedData || Object.keys(parsedData).length === 0) ? 0.5 : 1,
                    }}>Apply to Form</button>
                  <button onClick={() => setStep(0)} className="btn btn-ghost" style={{ flex: 1 }}>Back</button>
                </div>
              </div>
            )}
            {step === 3 && (
              <div style={{ textAlign: 'center' }}>
                <i className="fas fa-check-circle" style={{ fontSize: '2rem', color: 'var(--teal)', marginBottom: 8 }} />
                <p style={{ color: 'var(--teal)', fontWeight: 700 }}>Data Successfully Applied!</p>
                <button onClick={() => { setStep(0); setInputText(''); setParsedData(null); }} className="btn btn-ghost">
                  Import Another
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    /* ─── Default: text input ─── */
    case 'input':
      // Detect requestingOfficer by name regardless of type
      if (field.name === 'requestingOfficer') {
        return <OfficerSearch field={field} value={value} onChange={onChange} allValues={allValues} onFieldChange={onFieldChange} agencyOptions={agencyOptions} noCheckbox={field.type === 'officer_info'} />;
      }
      // fall through
    default:
      return (
        <div className="field">
          <label>{field.label}{field.required && <span className="req">*</span>}</label>
          {field.name === 'decedentName' && allValues.typeOfDeath === 'PK' ? (
            <div>
              <input type="text" value={allValues.decedentName || 'John Doe'} disabled
                style={{ opacity: 0.6, cursor: 'not-allowed' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button"
                  onClick={() => onFieldChange('decedentName', 'John Doe')}
                  style={{
                    flex: 1, padding: '0.6rem',
                    background: allValues.decedentName === 'John Doe' ? 'var(--teal)' : 'var(--bg-surface)',
                    border: '1px solid var(--border)', color: allValues.decedentName === 'John Doe' ? '#ffffff' : 'var(--text)',
                    borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                  }}>Male</button>
                <button type="button"
                  onClick={() => onFieldChange('decedentName', 'Jane Doe')}
                  style={{
                    flex: 1, padding: '0.6rem',
                    background: allValues.decedentName === 'Jane Doe' ? 'var(--teal)' : 'var(--bg-surface)',
                    border: '1px solid var(--border)', color: allValues.decedentName === 'Jane Doe' ? '#ffffff' : 'var(--text)',
                    borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                  }}>Female</button>
              </div>
            </div>
          ) : (
            <input type="text" value={value || ''} onChange={e => onChange(e.target.value)}
              placeholder={field.placeholder || ''} />
          )}
          {field.hint && <div className="hint">{field.hint}</div>}

          {/* Map button for placeOfDeath */}
          {field.name === 'placeOfDeath' && setShowMapModal && (
            <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
              {!isUploadingMapImage?.[field.name] && !allValues[`${field.name}_isFromMap`] && (
                <button className="btn btn-ghost" style={{ flex: 1, fontSize: 11.5 }}
                  onClick={() => { setMapTargetField?.('placeOfDeath'); setShowMapModal?.(true); }}>
                  <i className="fas fa-map-marked-alt me-1" /> Select from Map
                </button>
              )}
              {allValues[`${field.name}_isFromMap`] && (
                <button className="btn btn-ghost" style={{ flex: 1, fontSize: 11.5 }}
                  onClick={() => {
                    onFieldChange('placeOfDeath_isFromMap', false);
                    onFieldChange('placeOfDeath_display', '');
                    onFieldChange('placeOfDeath', allValues.placeOfDeath_display || '');
                  }}>
                  Use Manual Text
                </button>
              )}
            </div>
          )}
        </div>
      );
  }
};

/* ─── Officer Search Component (extracted so hooks are at top level) ─── */
const OfficerSearch = ({ field, value, onChange, allValues, onFieldChange = () => {}, agencyOptions, noCheckbox = false, disabled, hideDeptSelect = false, hideLabel = false, inline = false }) => {
  const reqOn = noCheckbox ? true : !!value;
  const officerName = noCheckbox ? (typeof value === 'string' ? value.trim() : '') : (reqOn ? (typeof value === 'string' ? value.trim() : '') : '');
  // When embedded in a checkbox pattern, `disabled` is passed explicitly; otherwise
  // the input is gated by the Requested checkbox.
  const inputDisabled = disabled !== undefined ? disabled : (noCheckbox ? false : !reqOn);
  const deptOptions = agencyOptions.length > 0 ? agencyOptions : [
    { value: 'lspd', label: 'Los Santos Police Department' },
    { value: 'lssd', label: 'Los Santos County Sheriffs Department' },
    { value: 'sadcr', label: 'San Andreas Department of Corrections and Rehabilitation' },
    { value: 'dao', label: 'District Attorney Office' },
  ];
  const currentDept = allValues?.department || allValues?.requestingOfficerDepartment || '';

  const [searchResults, setSearchResults] = useState([]);
  const [waiting, setWaiting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [noMatch, setNoMatch] = useState(false);
  const lastSearched = useRef('');
  const userTypedRef = useRef(false);

  useEffect(() => {
    if (!reqOn || officerName.length < 3) { setSearchResults([]); setNoMatch(false); setWaiting(false); return; }
    if (officerName === lastSearched.current) { setWaiting(false); return; }

    // Values restored programmatically (form switch, saved report, etc.) never
    // trigger the input's onChange, so userTypedRef stays false. In that case
    // the name was already confirmed in a previous session — don't re-run the
    // API search (which would pop the dropdown over a filled-in name).
    if (!userTypedRef.current) { setWaiting(false); return; }

    // Debounce window — show "Waiting..." so the user knows the search will
    // start after they stop typing (2s), before the actual API call ("Searching...").
    setWaiting(true);
    const timer = setTimeout(async () => {
      devLog(`[OfficerSearch] Name: "${officerName}", Dept: "${currentDept}" — calling triggerCheckOfficerName`);
      setWaiting(false);
      setSearching(true);
      // Small tick so React commits the "Searching..." text before the async call
      await new Promise(r => setTimeout(r, 50));
      lastSearched.current = officerName;
      try {
        const result = await triggerCheckOfficerName({ name: officerName, department: currentDept || undefined });
        devLog(`[OfficerSearch] Result:`, result);
        // The API returns different shapes depending on department:
        //   auto-detect   → { found, count, matches: [...] }
        //   specific-dept → { found, department, name, altMatch }
        // Normalize both so the dropdown renders no matter which mode ran.
        let matches = result?.matches || [];
        if (matches.length === 0 && result?.found && result?.name) {
          matches = [{ name: result.name, department: result.department || currentDept || '' }];
          if (result.altMatch) matches.push({ name: result.altMatch.name, department: result.altMatch.department });
        }
        setSearchResults(matches);
        setNoMatch(matches.length === 0);
      } catch (err) {
        console.warn(`[OfficerSearch] API check failed:`, err?.message || err);
        setSearchResults([]);
        setNoMatch(false);
      }
      setSearching(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [officerName, currentDept, reqOn]);

  return (
    <div className={inline ? '' : `field${field.layout !== 'compact-50' ? ' full' : ''}`} style={{ position: 'relative', ...(inline ? { flex: '1 1 200px' } : {}) }}>
      {!hideLabel && <label>{field.label}</label>}
      {!noCheckbox && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12.5, color: 'var(--text)', marginBottom: 6 }}>
          <input type="checkbox" checked={reqOn}
            onChange={e => onChange(e.target.checked ? ' ' : '')}
            style={{ width: 16, height: 16, margin: 0 }} />
          Requested
        </label>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input type="text" value={officerName}
            onChange={e => { devLog(`[OfficerSearch] Input changed: "${e.target.value}"`); userTypedRef.current = true; lastSearched.current = ''; setNoMatch(false); onChange(e.target.value); }}
            placeholder={field.placeholder || 'Officer Name'}
            disabled={inputDisabled}
            style={{ width: '100%', opacity: inputDisabled ? 0.4 : 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '10px 12px', fontSize: 13, boxSizing: 'border-box' }} />
          {waiting && !searching && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-faint)' }}>Waiting...</div>}
          {searching && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-faint)' }}>Searching...</div>}
          {searchResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-accent)', borderRadius: 6, maxHeight: 180, overflow: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
              {searchResults.map((m, i) => (
                <div key={i} onClick={() => {
                  const deptMap = { lspd: 'Los Santos Police Department', lssd: 'Los Santos County Sheriffs Department', sadcr: 'San Andreas Department of Corrections and Rehabilitation', dao: 'District Attorney Office' };
                  const fullDept = deptMap[m.department?.toLowerCase()] || m.department;
                  devLog(`[OfficerSearch] Selected: "${m.name}" — setting department to "${fullDept}"`);
                  onChange(m.name);
                  if (fullDept && onFieldChange) onFieldChange('department', fullDept);
                  setSearchResults([]); setWaiting(false); setSearching(false); setNoMatch(false); lastSearched.current = m.name;
                }}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ color: 'var(--text)' }}>{m.name}</span>
                  <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--mono)', fontSize: 11 }}>{m.department?.toUpperCase()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {!hideDeptSelect && (
          <select value={currentDept}
            onChange={e => { onFieldChange('department', e.target.value); onFieldChange('requestingOfficerDepartment', e.target.value); }}
            style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
            <option value="">— Requesting Department —</option>
            {deptOptions.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        )}
      </div>
      {noMatch && !searching && (
        <div style={{ marginTop: 6, padding: '8px 12px', borderRadius: 6, background: 'var(--amber-dim)', border: '1px solid var(--amber)', color: 'var(--amber)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fas fa-user-slash" />
          <span>No matches found — is this an alternative account?</span>
        </div>
      )}
    </div>
  );
};

export default PrototypeFieldRenderer;
