import React, { useState, useEffect } from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import ImagePreview from '../components/ImagePreview';
import EmployeeCredentialsSection from '../components/EmployeeCredentialsSection.jsx';
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
    setShowEmployeeModal,
    isUploading,
    handleImageUpload,
    typeOfDeathOptions,
    mannerOfDeathOptions,
    requestingAgencyOptions,
    currentUtcTime,
    coronerGroupedOptions,
    onParseDecedentRequest,
}) => {
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

    

    const addDecedent = () => {
        setFormData(prevFormData => ({
            ...prevFormData,
            decedents: [...(prevFormData.decedents || []), { ...defaultDecedent, collapsed: false }]
        }));
    };

    const parseDecedentFromReport = (reportData) => {
        if (!reportData || !reportData.data) return;
        
        const reportFormData = reportData.data;
        const newDecedent = { ...defaultDecedent, collapsed: false };
        
        console.log('=== PARSING DECEDENT REPORT ===');
        console.log('Available fields in report:', Object.keys(reportFormData));
        
        // Map report data to decedent fields
        if (reportFormData.decedentName) {
            newDecedent.decedentName = reportFormData.decedentName;
            console.log('decedentName -', reportFormData.decedentName);
        }
        if (reportFormData.decedentOOC) {
            newDecedent.decedentOOC = reportFormData.decedentOOC;
            console.log('decedentOOC -', reportFormData.decedentOOC);
        }
        
        // Try multiple possible field names for Pronounced Time of Death
        if (reportFormData.pronouncedTimeOfDeath) {
            // Check if pronouncedTimeOfDeath is just time (HH:MM format) and needs date added
            const timeValue = reportFormData.pronouncedTimeOfDeath;
            if (timeValue && timeValue.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
                // It's just time format, try to combine with dateTime field for date
                if (reportFormData.dateTime && reportFormData.dateTime.includes('T')) {
                    // dateTime contains full datetime, extract date part
                    const datePart = reportFormData.dateTime.split('T')[0];
                    const combinedDateTime = `${datePart}T${timeValue}`;
                    newDecedent.pronouncedTimeOfDeath = combinedDateTime;
                    console.log('pronouncedTimeOfDeath (time + date from dateTime) -', combinedDateTime, 'from time:', timeValue, 'date extracted from:', reportFormData.dateTime);
                } else if (reportFormData.dateTime && reportFormData.dateTime.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    // dateTime is just a date
                    const combinedDateTime = `${reportFormData.dateTime}T${timeValue}`;
                    newDecedent.pronouncedTimeOfDeath = combinedDateTime;
                    console.log('pronouncedTimeOfDeath (time + date) -', combinedDateTime, 'from time:', timeValue, 'date:', reportFormData.dateTime);
                } else {
                    // Just use the time as-is
                    newDecedent.pronouncedTimeOfDeath = timeValue;
                    console.log('pronouncedTimeOfDeath (time only, no date found) -', timeValue);
                }
            } else {
                // It's already a full datetime
                newDecedent.pronouncedTimeOfDeath = timeValue;
                console.log('pronouncedTimeOfDeath (direct full datetime) -', timeValue);
            }
        } else if (reportFormData.date && reportFormData.dateTime) {
            // Death Reports use separate date and dateTime fields - combine them
            const combinedDateTime = `${reportFormData.date}T${reportFormData.dateTime}`;
            newDecedent.pronouncedTimeOfDeath = combinedDateTime;
            console.log('pronouncedTimeOfDeath (combined date + dateTime) -', combinedDateTime, 'from date:', reportFormData.date, 'time:', reportFormData.dateTime);
        } else if (reportFormData.dateTime) {
            // Fallback to just dateTime if it's a full datetime
            newDecedent.pronouncedTimeOfDeath = reportFormData.dateTime;
            console.log('pronouncedTimeOfDeath (from dateTime only) -', reportFormData.dateTime);
        } else if (reportFormData.timeOfDeath) {
            newDecedent.pronouncedTimeOfDeath = reportFormData.timeOfDeath;
            console.log('pronouncedTimeOfDeath (from timeOfDeath) -', reportFormData.timeOfDeath);
        } else {
            console.log('pronouncedTimeOfDeath - NO MATCH FOUND (available date:', reportFormData.date, 'dateTime:', reportFormData.dateTime, ')');
        }
        
        if (reportFormData.typeOfDeath) {
            newDecedent.typeOfDeath = reportFormData.typeOfDeath;
            console.log('typeOfDeath -', reportFormData.typeOfDeath);
        }
        if (reportFormData.placeOfDeath) {
            newDecedent.placeOfDeath = reportFormData.placeOfDeath;
            console.log('placeOfDeath -', reportFormData.placeOfDeath);
        }
        if (reportFormData.mannerOfDeath) {
            newDecedent.mannerOfDeath = reportFormData.mannerOfDeath;
            console.log('mannerOfDeath -', reportFormData.mannerOfDeath);
        }
        if (reportFormData.probableCauseOfDeath) {
            newDecedent.probableCauseOfDeath = reportFormData.probableCauseOfDeath;
            console.log('probableCauseOfDeath -', reportFormData.probableCauseOfDeath);
        }
        if (reportFormData.synopsis) {
            newDecedent.synopsis = reportFormData.synopsis;
            console.log('synopsis -', reportFormData.synopsis);
        }
        if (reportFormData.scenePhotos) {
            newDecedent.scenePhotos = reportFormData.scenePhotos;
            console.log('scenePhotos -', reportFormData.scenePhotos);
        }
        if (reportFormData.additionalImages) {
            newDecedent.additionalImages = reportFormData.additionalImages;
            console.log('additionalImages -', reportFormData.additionalImages);
        }
        
        console.log('=== FINAL PARSED DECEDENT ===');
        console.log(newDecedent);
        console.log('================================');
        
        // Add the new decedent to the form data
        setFormData(prevFormData => ({
            ...prevFormData,
            decedents: [...(prevFormData.decedents || []), newDecedent]
        }));
    };

    const updateDecedent = (index, field, value) => {
        setFormData(prevFormData => ({
            ...prevFormData,
            decedents: prevFormData.decedents.map((dec, i) => {
                if (i === index) {
                    // Only update the field value, not the collapsed state
                    return { ...dec, [field]: value };
                }
                return dec;
            })
        }));
    };

    useEffect(() => {
        // This effect runs once on mount to collapse any decedents that are already complete.
        setFormData(prevFormData => {
            if (!prevFormData.decedents) return prevFormData;
            const updatedDecedents = prevFormData.decedents.map(dec => ({
                ...dec,
                collapsed: isDecedentComplete(dec)
            }));
            return { ...prevFormData, decedents: updatedDecedents };
        });
    }, []); // Empty dependency array ensures this runs only once on mount

    const toggleCollapse = (index) => {
        setFormData(prevFormData => ({
            ...prevFormData,
            decedents: prevFormData.decedents.map((dec, i) => {
                if (i === index) {
                    return { ...dec, collapsed: !dec.collapsed };
                }
                return dec;
            })
        }));
    };

    const removeDecedent = (index) => {
        setFormData(prevFormData => ({
            ...prevFormData,
            decedents: prevFormData.decedents.filter((_, i) => i !== index)
        }));
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
            <EmployeeCredentialsSection 
                formData={formData}
                setFormData={setFormData}
                coroner={coronerGroupedOptions}
                handleSelectChange={handleSelectChange}
                setShowEmployeeModal={setShowEmployeeModal}
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

            <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
                <Button variant="primary" onClick={addDecedent}>
                    Add New Decedent
                </Button>
                <Button 
                    variant="info" 
                    onClick={() => {
                        // Custom implementation for parsing decedent reports
                        // We want to filter for Death Reports (v1) and Autopsy Reports (v4)
                        if (onParseDecedentRequest) {
                            onParseDecedentRequest((reportData) => {
                                console.log('Selected decedent report data for parsing:', reportData);
                                parseDecedentFromReport(reportData);
                            });
                        }
                    }}
                >
                    <i className="fas fa-file-import" style={{ marginRight: '5px' }}></i>
                    Parse Decedent Report
                </Button>
            </div>
            {(formData.decedents || []).map((dec, idx) => (
                <div key={idx}>
                    <CollapsibleHeader
                        title={`Decedent #${idx + 1} Information`}
                        isOpen={!dec.collapsed}
                        onToggle={() => toggleCollapse(idx)}
                        sectionId={`decedent-${idx}`}
                        onRemove={() => removeDecedent(idx)}
                        showRemoveButton={formData.decedents.length > 1}
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
                                <ImagePreview imageUrls={dec.scenePhotos} />
                                <span className="helper-text">This supports clipboard uploading, ctrl + V! | Hosted by ImgBB! - <a href="https://imgbb.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a></span>
                            </Form.Group>
                            <Form.Group className="mb-3 upload-container">
                                <Form.Label>Morgue and CDNA Images</Form.Label>
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
                                <ImagePreview imageUrls={dec.additionalImages} />
                                <span className="helper-text">This supports clipboard uploading, ctrl + V! | Hosted by ImgBB! - <a href="https://imgbb.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a></span>
                            </Form.Group>
                            
                        </div>
                    )}
                </div>
            ))}
        </>
    );
};

export default MassFatality;