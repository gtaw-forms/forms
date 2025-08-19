import React, { useState, useEffect } from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import Select from 'react-select';
const defaultDecedent = {
    decedentName: '',
    decedentOOC: '',
    dateTime: '',
    pronouncedTimeOfDeath: '',
    department: '',
    requestingOfficer: '',
    typeOfDeath: '',
    placeOfDeath: '',
    mannerOfDeath: '',
    synopsis: '',
    evidenceLocker: 'false',
    evidenceLockerID: '',
    probableCauseOfDeath: '',
    scenePhotos: '',
    additionalImages: '',
    morgueStatus: 'false',
    collapsed: false, // Added for collapsable functionality
};
const customSelectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: '38px',
        backgroundColor: '#16202c',
        color: '#eeeeeeb0',
        borderColor: state.isFocused ? '#86b7fe' : '#30363d',
        boxShadow: state.isFocused ? '0 0 0 0.25rem rgba(13, 110, 253, 0.25)' : null,
        '&:hover': {
            borderColor: '#86b7fe'
        }
    }),
    menu: (base) => ({
        ...base,
        backgroundColor: '#16202c',
        zIndex: 1000,
        border: '1px solid #30363d',
        borderRadius: '0.375rem'
    }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isFocused ? '#30363d' : '#16202c',
        color: '#eeeeeeb0',
        padding: '0.5rem 1rem',
        '&:hover': {
            backgroundColor: '#30363d'
        }
    }),
    multiValue: (base) => ({
        ...base,
        backgroundColor: '#30363d',
        color: '#eeeeeeb0'
    }),
    multiValueLabel: (base) => ({
        ...base,
        color: '#eeeeeeb0'
    }),
    multiValueRemove: (base) => ({
        ...base,
        color: '#6c757d',
        '&:hover': {
            backgroundColor: '#dc3545',
            color: '#fff'
        }
    }),
    input: (base) => ({
        ...base,
        color: '#eeeeeeb0'
    }),
    placeholder: (base) => ({
        ...base,
        color: '#6c757d'
    }),
    singleValue: (base) => ({
        ...base,
        color: '#eeeeeeb0'
    }),
    group: (base) => ({
        ...base,
        paddingTop: 8,
        paddingBottom: 8
    }),
    groupHeading: (base) => ({
        ...base,
        color: '#6c757d',
        fontWeight: 600,
        textTransform: 'uppercase',
        fontSize: '0.75rem',
        marginBottom: 4
    })
};


const isDecedentComplete = (dec) => {
    return (
        dec.decedentName.trim() !== '' &&
        dec.decedentOOC.trim() !== '' &&
        dec.pronouncedTimeOfDeath.trim() !== '' &&
        dec.typeOfDeath.trim() !== '' &&
        dec.placeOfDeath.trim() !== '' &&
        dec.mannerOfDeath.trim() !== '' &&
        dec.probableCauseOfDeath.trim() !== ''
    );
};

const CollapsibleHeader = ({ title, isOpen, onToggle, sectionId, onRemove, showRemoveButton }) => (
    <Button
        variant="link"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`collapse-${sectionId}`}
        style={{
            fontWeight: 'bold',
            marginTop: '1rem',
            padding: '0.5rem 0',
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            textAlign: 'left',
            border: 'none',
            background: 'none'
        }}
    >
        <span>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center' }}>
            {showRemoveButton && (
                <Button variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{ marginRight: '10px' }}>
                    Remove
                </Button>
            )}
            <i className={`fas ${isOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`} style={{ marginLeft: '10px' }}></i>
        </span>
    </Button>
);

const MassFatality = ({
    formData,
    handleChange,
    handleSelectChange,
    setFormData,
    setShowMissingEmployeeModal,
    isUploading,
    handleImageUpload,
    typeOfDeathOptions,
    mannerOfDeathOptions,
    requestingAgencyOptions,
    currentUtcTime,
    coronerGroupedOptions,
}) => {
    const [decedents, setDecedents] = useState(formData.decedents && Array.isArray(formData.decedents) ? formData.decedents : [{ ...defaultDecedent }]);
    const generateEvidenceLockerID = () => {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        const year = today.getFullYear().toString().slice(2, 4); // Get last 2 digits of year
        const baseID = `EV-${year}${month}${day}-`;
        // Append whatever the user types
        return baseID;
    };
    const [evidenceLockerChecked, setEvidenceLockerChecked] = useState(formData.evidenceLocker === 'true');

    const setGeneratedEvidenceLockerID = () => {
        setFormData(prev => ({
            ...prev,
            evidenceLockerID: generateEvidenceLockerID()
        }));
    };
    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            evidenceLockerID: '',
            evidenceLocker: 'false'
        }));
    }, [setFormData]);

    // Only update parent formData when decedents change
    useEffect(() => {
        setFormData(prevFormData => ({
            ...prevFormData,
            decedents
        }));
    }, [decedents]);

    useEffect(() => {
        if (formData.decedents && formData.decedents.length > 0) {
            setDecedents(formData.decedents);
        } else {
            setDecedents([{ ...defaultDecedent }]);
        }
    }, [formData.decedents]);

    const addDecedent = () => {
        setDecedents(prev => [...prev, { ...defaultDecedent, collapsed: false }]); // New decedents start expanded
    };

    const updateDecedent = (index, field, value) => {
        setDecedents(prev => prev.map((dec, i) => {
            if (i === index) {
                const updatedDec = { ...dec, [field]: value };
                // If a field is updated, ensure the block is expanded
                const shouldCollapse = isDecedentComplete(updatedDec);
                return { ...updatedDec, collapsed: shouldCollapse };
            }
            return dec;
        }));
    };

    const toggleCollapse = (index) => {
        setDecedents(prev => {
            const newDecedents = prev.map((dec, i) => {
                if (i === index) {
                    return { ...dec, collapsed: !dec.collapsed };
                }
                return dec;
            });
            return newDecedents;
        });
    };

    const removeDecedent = (index) => {
        setDecedents(prev => prev.filter((_, i) => i !== index));
    };

    const handleDoeChange = (index, type) => (e) => {
        const isChecked = e.target.checked;
        if (isChecked) {
            if (type === 'john') {
                updateDecedent(index, 'decedentName', 'John Doe');
            } else if (type === 'jane') {
                updateDecedent(index, 'decedentName', 'Jane Doe');
            }
        }
    };

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                <Form.Label style={{ marginBottom: 0 }}>Employee Credentials</Form.Label>
                <button
                    type="button"
                    onClick={() => setShowMissingEmployeeModal(true)}
                    className="close-button"
                    style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.8rem',
                        lineHeight: '1.2'
                    }}
                >
                    <i className="fas fa-question-circle" style={{ marginRight: '5px' }}></i>
                    Missing Name?
                </button>
            </div>
            <Select
                name="coronerEmployee"
                value={coronerGroupedOptions
                    .flatMap(group => group.options)
                    .find(option => option.value === formData.coronerEmployee) || null}
                // Corrected onChange handler:
                onChange={(selectedOption) => handleSelectChange(selectedOption, { name: 'coronerEmployee' })}
                options={coronerGroupedOptions}
                isClearable
                placeholder="Search or select coroner..."
                className={`form-control ${!formData.coronerEmployee ? 'is-invalid' : ''}`}
                styles={{ 
                    control: (base, state) => ({
                        ...base,
                        backgroundColor: '#16202c',
                        color: '#eeeeeeb0',
                        borderColor: !formData.coronerEmployee && state.isFocused ? '#dc3545' :
                                     !formData.coronerEmployee ? '#dc3545' :
                                     state.isFocused ? '#86b7fe' : '#6c757d',
                        '&:hover': {
                            borderColor: !formData.coronerEmployee ? '#dc3545' : '#86b7fe'
                        },
                        boxShadow: !formData.coronerEmployee && state.isFocused ? '0 0 0 0.25rem rgba(220, 53, 69, 0.25)' :
                                   state.isFocused ? '0 0 0 0.25rem rgba(13, 110, 253, 0.25)' : null,
                    }),
                    menu: (base) => ({ ...base, backgroundColor: '#16202c', zIndex: 1000 }),
                    option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? 'Grey' : '#16202c', color: '#eeeeeeb0' }),
                    singleValue: (base) => ({ ...base, color: '#eeeeeeb0' }),
                    input: (base) => ({ ...base, color: '#eeeeeeb0' }),
                    placeholder: (base) => ({ ...base, color: '#eeeeeeb0' }),
                    group: (base) => ({ ...base, paddingTop: 8, paddingBottom: 8 }),
                    groupHeading: (base) => ({ ...base, color: '#6c757d', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: 4 })
                }}
            />
            <Form.Label></Form.Label>
            <Form.Label>
                Dispatch Time | Incident Location
                <span style={{ fontSize: '0.8em', color: '#6c757d', marginLeft: '10px' }}>
                    (Current Server Time: {currentUtcTime})
                </span>
            </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    type="datetime-local"
                    name="dateTime"
                    value={formData.dateTime}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.dateTime ? 'is-invalid' : ''}`}
                />
            <Form.Control
                type="text"
                name="placeOfDeath"
                value={formData.placeOfDeath}
                onChange={handleChange}
                placeholder="Mass Fatality Incident Location "
                required
                className={`form-control ${!formData.placeOfDeath ? 'is-invalid' : ''}`}
            />
            </div>
            <Form.Group className="mb-3">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                    <Form.Check
                        type="checkbox"
                        label="Report Requested?"
                        name="showRequestingOfficerInput"
                        checked={formData.showRequestingOfficerInput || false}
                        onChange={handleChange}
                    />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>

                    <Form.Select
                        name="department"
                        value={formData.department}
                        onChange={handleChange}
                        required
                        className={`form-control ${!formData.department ? 'is-invalid' : ''}`}
                    >
                        <option value="" disabled>Select Requesting Agency</option>
                        {/* --- Updated to use requestingAgencyOptions --- */}
                        {requestingAgencyOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Form.Select>
                    {formData.showRequestingOfficerInput && (
                        <Form.Control
                            type="text"
                            name="requestingOfficer"
                            value={formData.requestingOfficer || ''}
                            onChange={handleChange}
                            placeholder="e.g: Officer John Doe, LSPD"
                        />
                    )}
                </div>
                            <Form.Control as="textarea" name="synopsis" value={formData.synopsis} onChange={handleChange} rows="4" placeholder="Brief Summary - (This covers what you initially located on scene and the overview of the patients) " required className={`form-control ${!formData.synopsis ? 'is-invalid' : ''}`} />
                
            </Form.Group>

            <Button variant="primary" onClick={addDecedent} style={{ marginBottom: '1rem' }}>
                Add New Decedent
            </Button>
            {decedents.map((dec, idx) => (
                <div key={idx}>
                    <CollapsibleHeader
                        title={`Decedent #${idx + 1} Information`}
                        isOpen={!dec.collapsed}
                        onToggle={() => toggleCollapse(idx)}
                        sectionId={`decedent-${idx}`}
                        onRemove={() => removeDecedent(idx)}
                        showRemoveButton={decedents.length > 1}
                    />
                    {!dec.collapsed && (
                        <div id={`decedent-collapse-${idx}`}>
                                        <div className="radio-button-group">
                                            <Form.Check type="radio" id={`johnDoe-${idx}`} name={`decedentName-${idx}`} label="John Doe" checked={dec.decedentName === 'John Doe'} onChange={handleDoeChange(idx, 'john')} inline />
                                            <Form.Check type="radio" id={`janeDoe-${idx}`} name={`decedentName-${idx}`} label="Jane Doe" checked={dec.decedentName === 'Jane Doe'} onChange={handleDoeChange(idx, 'jane')} inline />
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <Form.Control type="text" value={dec.decedentName} placeholder="Decedent Name (IC)" onChange={e => updateDecedent(idx, 'decedentName', e.target.value)} />
                                            <Form.Control type="text" value={dec.decedentOOC} placeholder="Decedent Name (OOC)" onChange={e => updateDecedent(idx, 'decedentOOC', e.target.value)} />
                                        </div>
                                                            <Form.Label>Pronounced Time of Death</Form.Label>

                                        <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control type="datetime-local" value={dec.pronouncedTimeOfDeath} onChange={e => updateDecedent(idx, 'pronouncedTimeOfDeath', e.target.value)} />
                                      <Form.Control type="text" value={dec.probableCauseOfDeath} placeholder="Probable cause of Death" onChange={e => updateDecedent(idx, 'probableCauseOfDeath', e.target.value)} />

                             <Form.Select value={dec.typeOfDeath} onChange={e => updateDecedent(idx, 'typeOfDeath', e.target.value)}>
                                    <option value="" disabled>Select Type of Death</option>
                                    {typeOfDeathOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </Form.Select>
                                </div>   
                                                                        <div style={{ display: 'flex', gap: '10px' }}>

                                <Form.Control type="text" value={dec.placeOfDeath} placeholder='Place of Death' onChange={e => updateDecedent(idx, 'placeOfDeath', e.target.value)} />
                                <Form.Select value={dec.mannerOfDeath} onChange={e => updateDecedent(idx, 'mannerOfDeath', e.target.value)}>
                                    <option value="" disabled>Select Manner of Death</option>
                                    {mannerOfDeathOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </Form.Select>
                                </div>
                            <Form.Group className="mb-3">
                                <Form.Label>Decedent Injuries / Things of Note</Form.Label>
                                <Form.Control as="textarea" rows={3} value={dec.synopsis} onChange={e => updateDecedent(idx, 'synopsis', e.target.value)} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <label>Evidence Locker Submission:</label>
                                <Form.Check
                                    type="checkbox"
                                    id="evidenceLocker"
                                    label="       I have submitted evidence to the evidence locker"
                                    checked={evidenceLockerChecked}
                                    onChange={(e) => {
                                        setEvidenceLockerChecked(e.target.checked);
                                        setFormData(prev => ({
                                            ...prev,
                                            evidenceLocker: e.target.checked.toString(),
                                        }));

                                        if (e.target.checked) {
                                            setGeneratedEvidenceLockerID();
                                        } else {
                                            setFormData(prev => ({
                                                ...prev,
                                                evidenceLockerID: ''
                                            }));
                                        }
                                    }}
                                />

                                {evidenceLockerChecked && (
                                    <Form.Control
                                        type="text"
                                        name="evidenceLockerID"
                                        value={formData.evidenceLockerID || generateEvidenceLockerID()}
                                        onChange={handleChange}
                                        placeholder={generateEvidenceLockerID() + " Your Submission Number Here"}
                                        required
                                        className={`form-control ${!formData.evidenceLockerID ? 'is-invalid' : ''}`}
                                    />
                                )}
                            </Form.Group>
                            <Form.Group className="mb-3 upload-container">
                                <Form.Label>Scene Photos</Form.Label>
                                <InputGroup>
                                    <Form.Control
                                        as="textarea"
                                        rows={2}
                                        value={dec.scenePhotos}
                                        onChange={e => updateDecedent(idx, 'scenePhotos', e.target.value)}
                                        placeholder="Paste image URL or Upload"
                                        onPaste={e => {
                                            const clipboardData = e.clipboardData || window.clipboardData;
                                            const pastedData = clipboardData.getData('text');
                                            const items = clipboardData.items;
                                            let hasImageItem = false;
                                            const urlRegex = /(https?:\/\/[^\s]+)/g;
                                            const containsUrl = urlRegex.test(pastedData);
                                            for (let i = 0; i < items.length; i++) {
                                                if (items[i].type.indexOf('image') !== -1) {
                                                    hasImageItem = true;
                                                    const file = items[i].getAsFile();
                                                    handleImageUpload({ target: { files: [file] } }, `scenePhotos-${idx}`);
                                                    e.preventDefault();
                                                    break;
                                                }
                                            }
                                            if (containsUrl && !hasImageItem) {
                                                const currentValue = dec.scenePhotos || '';
                                                const cursorPos = e.target.selectionStart;
                                                const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                                                const newValue = currentValue.slice(0, cursorPos) +
                                                    (cursorPos > 0 ? separator : '') +
                                                    pastedData +
                                                    currentValue.slice(cursorPos);
                                                updateDecedent(idx, 'scenePhotos', newValue);
                                                e.preventDefault();
                                            }
                                        }}
                                    />
                                    <Button
                                        variant="success"
                                        disabled={isUploading}
                                        onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = 'image/*';
                                            input.multiple = true;
                                            input.onchange = (e) => handleImageUpload(e, `scenePhotos-${idx}`);
                                            input.click();
                                        }}
                                    >
                                        <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                                        {isUploading ? ' Uploading...' : ' Upload Image(s)'}
                                    </Button>
                                </InputGroup>
                                <span className="helper-text">This supports clipboard uploading, ctrl + V! | Hosted by Imgur! - <a href="https://imgur.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a></span>
                            </Form.Group>
                            <Form.Group className="mb-3 upload-container">
                                <Form.Label>Additional Images</Form.Label>
                                <InputGroup>
                                    <Form.Control
                                        as="textarea"
                                        rows={2}
                                        value={dec.additionalImages}
                                        onChange={e => updateDecedent(idx, 'additionalImages', e.target.value)}
                                        placeholder="Paste image URL or Upload"
                                        onPaste={e => {
                                            const clipboardData = e.clipboardData || window.clipboardData;
                                            const pastedData = clipboardData.getData('text');
                                            const items = clipboardData.items;
                                            let hasImageItem = false;
                                            const urlRegex = /(https?:\/\/[^\s]+)/g;
                                            const containsUrl = urlRegex.test(pastedData);
                                            for (let i = 0; i < items.length; i++) {
                                                if (items[i].type.indexOf('image') !== -1) {
                                                    hasImageItem = true;
                                                    const file = items[i].getAsFile();
                                                    handleImageUpload({ target: { files: [file] } }, `additionalImages-${idx}`);
                                                    e.preventDefault();
                                                    break;
                                                }
                                            }
                                            if (containsUrl && !hasImageItem) {
                                                const currentValue = dec.additionalImages || '';
                                                const cursorPos = e.target.selectionStart;
                                                const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                                                const newValue = currentValue.slice(0, cursorPos) +
                                                    (cursorPos > 0 ? separator : '') +
                                                    pastedData +
                                                    currentValue.slice(cursorPos);
                                                updateDecedent(idx, 'additionalImages', newValue);
                                                e.preventDefault();
                                            }
                                        }}
                                    />
                                    <Button
                                        variant="success"
                                        disabled={isUploading}
                                        onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = 'image/*';
                                            input.multiple = true;
                                            input.onchange = (e) => handleImageUpload(e, `additionalImages-${idx}`);
                                            input.click();
                                        }}
                                    >
                                        <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                                        {isUploading ? ' Uploading...' : ' Upload Image(s)'}
                                    </Button>
                                </InputGroup>
                                <span className="helper-text">This supports clipboard uploading, ctrl + V! | Hosted by Imgur! - <a href="https://imgur.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a></span>
                            </Form.Group>
                            
                        </div>
                    )}
                </div>
            ))}
        </>
    );
};

export default MassFatality;