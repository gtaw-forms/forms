import React, { useMemo } from 'react'; // Added useMemo
import { Form, Button, InputGroup } from 'react-bootstrap';
import Select from 'react-select';

// customSelectStyles remains the same

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


const EmergencyForm = ({
    formData,
    handleChange,
    setFormData,
    phmcRank,
    phmcGroupedOptions,
    setShowEmployeeModal,
    lab,
    painLevel,
    temperature,
    heartRate,
    breathing,
    bloodPressure,
    findings,
    lungs,
    pupils,
    wounds,
    ecg,
    sono,
    admission,
    bloodOxy,
    handleSelectChange,
    followup,
    isUploading,
    handleImageUpload,
    Imaging,
    XrayResults,
    ctResults,
    mriResults,
    ultrasoundResults
}) => {

    const imagingOptionsMapping = useMemo(() => ({
        XRay: { options: XrayResults || [], formDataKey: 'XrayResults', label: 'X-Ray Results' },
        CTScan: { options: ctResults || [], formDataKey: 'ctResults', label: 'CT Scan Results' },
        MRI: { options: mriResults || [], formDataKey: 'mriResults', label: 'MRI Results' },
        Ultrasound: { options: ultrasoundResults || [], formDataKey: 'ultrasoundResults', label: 'Ultrasound Results' },
    }), [XrayResults, ctResults, mriResults, ultrasoundResults]);

    const groupedImagingResultsOptions = useMemo(() => {
        if (!formData.Imaging || formData.Imaging.length === 0 || formData.Imaging.includes('NoneRequired')) {
            return [];
        }
        return formData.Imaging.reduce((acc, imagingType) => {
            const mapping = imagingOptionsMapping[imagingType];
            if (mapping && mapping.options.length > 0) {
                acc.push({
                    label: mapping.label,
                    options: mapping.options.map(opt => ({ ...opt, imagingType: imagingType, originalFormDataKey: mapping.formDataKey }))
                });
            }
            return acc;
        }, []);
    }, [formData.Imaging, imagingOptionsMapping]);

    const selectedImagingResultsValue = useMemo(() => {
        const selectedValues = [];

        if (formData.Imaging && !formData.Imaging.includes('NoneRequired')) {
            formData.Imaging.forEach(imagingType => {
                const mapping = imagingOptionsMapping[imagingType];
                if (mapping && formData[mapping.formDataKey]) {
                    const resultsForType = formData[mapping.formDataKey];
                    resultsForType.forEach(resultValue => {
                        const option = mapping.options.find(opt => opt.value === resultValue);
                        if (option) {
                            selectedValues.push({
                                ...option,
                                imagingType: imagingType,
                                originalFormDataKey: mapping.formDataKey
                            });
                        }
                    });
                }
            });
        }
        return selectedValues;
    }, [formData, imagingOptionsMapping]);

 const handleImagingResultsChange = (selectedOptions) => {
     console.log("handleImagingResultsChange called with:", selectedOptions);

         const newFormDataSlice = {};
     // Initialize all relevant formData keys to empty arrays
     Object.values(imagingOptionsMapping).forEach(mapping => {
         newFormDataSlice[mapping.formDataKey] = [];
     });

    if (selectedOptions && selectedOptions.length > 0 && !selectedOptions.some(opt => opt.value === 'NoneRequired')) {
        selectedOptions.forEach(option => {
            const { originalFormDataKey, value } = option;
            if (originalFormDataKey && newFormDataSlice[originalFormDataKey]) {
                newFormDataSlice[originalFormDataKey].push(value);
            }
        });
    }

    setFormData(prev => ({
        ...prev,
        ...newFormDataSlice
    }));
};
    return (
        <>
            {/* ... (Your existing form fields up to the Findings section) ... */}
            <p>If you require assistance with this form <a href="https://phmc.gta.world/viewforum.php?f=66" target="_blank" rel="noopener noreferrer">use this link! It should contain the information you require.  </a> If you still need help, use the PHMC Discord. </p>
            <Form.Control
                type="text"
                name="patientID"
                value={formData.patientID}
                onChange={handleChange}
                placeholder="Patient ID"
                required
                className={`form-control ${!formData.patientID ? 'is-invalid' : ''}`}
            />

            <Form.Label>Date:</Form.Label>
            <Form.Control
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                className={`form-control ${!formData.date ? 'is-invalid' : ''}`}
            />

            <Form.Select
                name="phmcRank"
                value={formData.phmcRank}
                onChange={handleChange}
                required
                className={`form-control ${!formData.phmcRank ? 'is-invalid' : ''}`}
            >
                <option value="" disabled>PHMC Rank</option>
                {phmcRank.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </Form.Select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                <Form.Label style={{ marginBottom: 0 }}>Employee Credentials</Form.Label>
                <button
                    type="button"
                    onClick={() => setShowEmployeeModal(true)}
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
                name="phmcEmployee"
                value={phmcGroupedOptions
                    .flatMap(group => group.options)
                    .find(option => option.value === formData.phmcEmployee) || null}
                onChange={(selectedOption) => {
                    handleSelectChange(selectedOption, { name: 'phmcEmployee' });
                    const lastName = selectedOption ? selectedOption.lastName : '';
                    setFormData(prev => ({
                        ...prev,
                        phmcEmployee: selectedOption ? selectedOption.value : '',
                        lastName: lastName
                    }));
                }}
                options={phmcGroupedOptions}
                isClearable
                placeholder="Search or select doctor..."
                className={`form-control p-0 ${!formData.phmcEmployee ? 'is-invalid' : ''}`}
                classNamePrefix="react-select"
                styles={customSelectStyles}
            />
            <Form.Label></Form.Label> {/* Spacer */}
                        <Form.Label>Anamnesis:</Form.Label>

            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Select
                    name="painLevel"
                    value={formData.painLevel}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.painLevel ? 'is-invalid' : ''}`}
                >
                    <option value="" disabled>Pain Scale </option>
                    {painLevel.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </Form.Select>
                <Form.Control
                    type="text"
                    name="patientChiefComplaint"
                    value={formData.patientChiefComplaint}
                    onChange={handleChange}
                    placeholder="Patient Chief Complaint"
                    required
                    className={`form-control ${!formData.patientChiefComplaint ? 'is-invalid' : ''}`}
                />
                    <Form.Control
                    type="text"
                    name="patientInjuryMechanism"
                    value={formData.patientInjuryMechanism}
                    onChange={handleChange}
                    placeholder="Patient Mechanism of Injury (if applicable)"
                    required
                    className={`form-control ${!formData.patientInjuryMechanism ? 'is-invalid' : ''}`}
                />

            </div>
            <Form.Label>Vitals Section </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Select name="temperature" value={formData.temperature} onChange={handleChange} required className={`form-control ${!formData.temperature ? 'is-invalid' : ''}`}>
                    <option value="" disabled>Vitals</option>
                    {temperature.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </Form.Select>
                <Form.Select name="heartRate" value={formData.heartRate} onChange={handleChange} required className={`form-control ${!formData.heartRate ? 'is-invalid' : ''}`}>
                    <option value="" disabled>Heart Rate</option>
                    {heartRate.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </Form.Select>
                <Form.Select name="breathing" value={formData.breathing} onChange={handleChange} required className={`form-control ${!formData.breathing ? 'is-invalid' : ''}`}>
                    <option value="" disabled>Breathing</option>
                    {breathing.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </Form.Select>
                <Form.Select name="bloodPressure" value={formData.bloodPressure} onChange={handleChange} required className={`form-control ${!formData.bloodPressure ? 'is-invalid' : ''}`}>
                    <option value="" disabled>Blood Pressure</option>
                    {bloodPressure.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </Form.Select>
                <Form.Select name="bloodOxy" value={formData.bloodOxy} onChange={handleChange} required className={`form-control ${!formData.bloodOxy ? 'is-invalid' : ''}`}>
                    <option value="" disabled>Blood Oxygen</option>
                    {bloodOxy.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </Form.Select>
            </div>
            <Form.Label>Findings </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Select name="findings" value={formData.findings} onChange={handleChange} required className={`form-control ${!formData.findings ? 'is-invalid' : ''}`}>
                    <option value="" disabled>General Health Conditions</option>
                    {findings.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </Form.Select>
                <Form.Select name="lungs" value={formData.lungs} onChange={handleChange} required className={`form-control ${!formData.lungs ? 'is-invalid' : ''}`}>
                    <option value="" disabled>Patient Lungs</option>
                    {lungs.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </Form.Select>
                <Form.Select name="pupils" value={formData.pupils} onChange={handleChange} required className={`form-control ${!formData.pupils ? 'is-invalid' : ''}`}>
                    <option value="" disabled>Patient Pupils</option>
                    {pupils.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </Form.Select>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Select name="wounds" value={formData.wounds} onChange={handleChange} required className={`form-control ${!formData.wounds ? 'is-invalid' : ''}`}>
                    <option value="" disabled>Patient Wounds</option>
                    {wounds.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </Form.Select>
                <Form.Select name="ecg" value={formData.ecg} onChange={handleChange} required className={`form-control ${!formData.ecg ? 'is-invalid' : ''}`}>
                    <option value="" disabled>ECG Results</option>
                    {ecg.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </Form.Select>
                <Form.Select name="sono" value={formData.sono} onChange={handleChange} required className={`form-control ${!formData.sono ? 'is-invalid' : ''}`}>
                    <option value="" disabled>Sono</option>
                    {sono.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </Form.Select>
            </div>


            {/* Imaging Type Select */}
            <Form.Label style={{ marginTop: '0.5rem' }}>Imaging Performed</Form.Label>
<Select
    isMulti
    name="Imaging"
    value={(Imaging || []).filter(option =>
        formData.Imaging?.includes(option.value)
    )}
    onChange={(selectedOptions) => {
        console.log("Imaging Select onChange:", selectedOptions);
        const newImagingSelectionValues = selectedOptions ? selectedOptions.map(option => option.value) : [];
        let updatedFormDataSlice = { Imaging: [] };

        if (newImagingSelectionValues.includes('NoneRequired')) {
            updatedFormDataSlice.Imaging = ['NoneRequired'];
            Object.values(imagingOptionsMapping).forEach(mapping => {
                updatedFormDataSlice[mapping.formDataKey] = [];
            });
        } else {
            updatedFormDataSlice.Imaging = newImagingSelectionValues.filter(val => val !== 'NoneRequired');
            const oldImagingSelectionValues = formData.Imaging || [];
            oldImagingSelectionValues.forEach(type => {
                if (type !== 'NoneRequired' && !updatedFormDataSlice.Imaging.includes(type)) {
                    const mapping = imagingOptionsMapping[type];
                    console.log(`Mapping for type "${type}":`, mapping); // <---- ADD THIS LOG
                    if (mapping) {
                        if (!updatedFormDataSlice.hasOwnProperty(mapping.formDataKey)) {
                             updatedFormDataSlice[mapping.formDataKey] = [];
                        }
                    }
                }
            });
        }
        console.log("Imaging Select onChange - updatedFormDataSlice:", updatedFormDataSlice);
        setFormData(prev => ({ ...prev, ...updatedFormDataSlice }));
    }}
    options={Imaging || []}
    className={`form-control p-0 ${(!formData.Imaging || formData.Imaging.length === 0) && !(formData.Imaging?.includes('NoneRequired')) ? 'is-invalid' : ''}`}
    classNamePrefix="react-select"
    placeholder="Select Imaging Type(s)... (Multi-select)"
    styles={customSelectStyles}
/>
            <Form.Label></Form.Label>

            {/* Single Merged Imaging Results Select - Conditionally Rendered */}
            {formData.Imaging && formData.Imaging.length > 0 && !formData.Imaging.includes('NoneRequired') && (
                <>
                    <Form.Label>Imaging Results</Form.Label>
                    <Select
                        isMulti
                        name="CombinedImagingResults"
                        value={selectedImagingResultsValue}
                        onChange={handleImagingResultsChange}
                        options={groupedImagingResultsOptions}
                        className={`form-control p-0 mb-2`}
                        classNamePrefix="react-select"
                        placeholder="Select Imaging Result(s)..."
                        styles={customSelectStyles}
                    />
                </>
            )}
            <Form.Label></Form.Label>


            <Select
                isMulti
                name="lab"
                value={(lab || []).filter(option =>
                    formData.lab?.includes(option.value)
                )}
                onChange={(selectedOptions) => {
                    setFormData(prev => ({
                        ...prev,
                        lab: selectedOptions ? selectedOptions.map(option => option.value) : []
                    }));
                }}
                options={lab || []}
                className={`form-control p-0 ${!formData.lab || formData.lab.length === 0 ? 'is-invalid' : ''}`}
                classNamePrefix="react-select"
                placeholder="Select lab results... (Multi-select)"
                styles={customSelectStyles}
            />
            <Form.Label></Form.Label> {/* Spacer */}

            {/* ... (rest of your form: Preliminary Diagnosis, Discharge Notes, etc.) ... */}
            <Form.Label>Preliminary Diagnosis </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control as="textarea" name="patientProcedure" value={formData.patientProcedure} onChange={handleChange} rows="4" placeholder="Procedures conducted on Patient" required className={`form-control ${!formData.patientProcedure ? 'is-invalid' : ''}`} />
                <Form.Control as="textarea" name="patientDiagnosis" value={formData.patientDiagnosis} onChange={handleChange} rows="4" placeholder="Patient Diagnosis" required className={`form-control ${!formData.patientDiagnosis ? 'is-invalid' : ''}`} />
                <Form.Control as="textarea" name="patientSecondaryDiagnosis" value={formData.patientSecondaryDiagnosis} onChange={handleChange} rows="4" placeholder="Patient Secondary Diagnosis" required className={`form-control ${!formData.patientSecondaryDiagnosis ? 'is-invalid' : ''}`} />
            </div>
            <Form.Select name="admission" value={formData.admission} onChange={handleChange} required className={`form-control ${!formData.admission ? 'is-invalid' : ''}`}>
                <option value="" disabled>Patient Admitted?</option>
                {admission.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
            </Form.Select>
            <Form.Label>Discharge Notes </Form.Label>
            <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                <Form.Control as="textarea" name="patientMedicine" value={formData.patientMedicine} onChange={handleChange} rows="3" placeholder="Treatment Plan Notes (verbal advice/further recommendations/additional notes)" required className={`form-control mb-2 ${!formData.patientMedicine ? 'is-invalid' : ''}`} />
                <Form.Group className="mb-2 upload-container">
                    <InputGroup>
                        <Form.Control as="textarea" rows={2} name="prescriptionImage" value={formData.prescriptionImage || ''} onChange={handleChange} placeholder="You MUST upload an image of the prescription slip in this section for recordkeeping purposes. (If Applicable)" className={`form-control`}
                            onPaste={(e) => {
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
                                        handleImageUpload({ target: { files: [file] } }, 'prescriptionImage');
                                        e.preventDefault();
                                        break;
                                    }
                                }
                                if (containsUrl && !hasImageItem) {
                                    const currentValue = formData.prescriptionImage || '';
                                    const cursorPos = e.target.selectionStart;
                                    const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                                    const newValue = currentValue.slice(0, cursorPos) + (cursorPos > 0 ? separator : '') + pastedData + currentValue.slice(cursorPos);
                                    setFormData(prev => ({ ...prev, prescriptionImage: newValue }));
                                    e.preventDefault();
                                }
                            }}
                        />
                        <Button variant="success" disabled={isUploading} onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.multiple = true; input.onchange = (e) => handleImageUpload(e, 'prescriptionImage'); input.click(); }}>
                            <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i> {isUploading ? 'Uploading...' : 'Upload Prescription'}
                        </Button>
                    </InputGroup>
                    <span className="helper-text">Upload an image of the prescription slip if applicable.</span>
                </Form.Group>
                {formData.admission === 'No' && (
                    <Form.Select name="followup" value={formData.followup} onChange={handleChange} required className={`form-control ${!formData.followup ? 'is-invalid' : ''}`}>
                        <option value="" disabled>Follow Up Required?</option>
                        {(followup || []).map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                    </Form.Select>
                )}
            </div>
        </>
    );
};

export default EmergencyForm;
