import React from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import Select from 'react-select';

const MedicalRelease = ({
    formData,
    handleChange,
    setFormData,
    patientTitleOptions, // Updated: Was patientTitle
    patientPhoneOptions, // Updated: Was patientPhone
    purposeOptions,
    formatOptions, // Updated: Was PurposeMedicalInformationReleaseFormat
    medicalRecordOptions, // Updated: Was MedicalRecordsRelease
    phmcGroupedOptions,
    handleImageUpload,
    isUploading,

}) => {

    const calculateCost = () => {
        const selectedCount = formData.MedicalRecordsRelease?.length || 0;
        if (selectedCount === 0) {
            return 0;
        }
        const costPerItem = 5000;
        return selectedCount * costPerItem;
    };
    const approximateCost = calculateCost();

    return (
        <>        <Form.Group className="mb-3">

        <Form.Label>Title / First Name / Middle Name / Lastname / Date of Birth</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                    <Form.Select
                    name="patientTitle"
                    value={formData.patientTitle}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.patientTitle ? 'is-invalid' : ''}`}
                >
                    <option value="" disabled>Title</option>
                    {/* Updated to use patientTitleOptions prop */}
                    {(patientTitleOptions || []).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </Form.Select>
                <Form.Control
                    type="text"
                    name="patientFirstName"
                    value={formData.patientFirstName}
                    onChange={handleChange}
                    placeholder="First Name"
                    required
                    className={`form-control ${!formData.patientFirstName ? 'is-invalid' : ''}`}

                />

                <Form.Control
                    type="text"
                    name="patientMiddleName"
                    value={formData.patientMiddleName}
                    onChange={handleChange}
                    placeholder="Middle Name (Optional)"
                    className={`form-control ${!formData.patientMiddleName ? 'is-invalid' : ''}`}

                />
                    <Form.Control
                    type="text"
                    name="patientLastName"
                    value={formData.patientLastName}
                    onChange={handleChange}
                    placeholder="Last Name"
                    required
                    className={`form-control ${!formData.patientLastName ? 'is-invalid' : ''}`}

                />
                <Form.Control
                    type="date"
                    name="patientDateOfBirth"
                    value={formData.patientDateOfBirth}
                    onChange={handleChange}
                    placeholder="Date of Birth"
                    required
                    className={`form-control ${!formData.patientDateOfBirth ? 'is-invalid' : ''}`}

                />

            </div>
            <Form.Label>Gender:</Form.Label>
                <Form.Check
                    type="radio"
                    label="   Male"
                    name="patientGender"
                    value="Male"
                    checked={formData.patientGender === 'Male'}
                    onChange={handleChange}
                />
                <Form.Check
                    type="radio"
                    label="   Female"
                    name="patientGender"
                    value="Female"
                    checked={formData.patientGender === 'Female'}
                    onChange={handleChange}
                />

        </Form.Group>
        <Form.Group className="mb-3">
            <Form.Label>Address & ZIP / Postal Code</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    type="text"
                    name="patientAddress"
                    value={formData.patientAddress}
                    onChange={handleChange}
                    placeholder="Address (Number, Floor, Street)"
                    required
                    className={`form-control ${!formData.patientAddress ? 'is-invalid' : ''}`}

                />
                <Form.Control
                    type="text"
                    name="patientZIP"
                    value={formData.patientZIP}
                    onChange={handleChange}
                    placeholder="ZIP / Postal Code ((You can make this up))"
                    required
                    className={`form-control ${!formData.patientZIP ? 'is-invalid' : ''}`}

                />
            </div>
        </Form.Group>
            <Form.Label>Contact Information</Form.Label>
            <div className="input-group">
            <Form.Select
            name="patientPhoneType"
            value={formData.patientPhoneType}
            onChange={(e) => {
                const selectedType = e.target.value;
                setFormData(prev => ({
                    ...prev,
                    patientPhoneType: selectedType,
                    patientPhoneMobile: selectedType === 'Mobile' ? prev.patientPhoneMobile : '',
                    patientPhoneHome: selectedType === 'Home' ? prev.patientPhoneHome : '',
                    patientPhoneWork: selectedType === 'Work' ? prev.patientPhoneWork : '',
                    patientPhoneOther: selectedType === 'Other' ? prev.patientPhoneOther : '',
                }));
            }}
            required
            className={`form-control ${!formData.patientPhoneType ? 'is-invalid' : ''}`}
        >
            <option value="" disabled>Phone Type</option>
            {/* Updated to use patientPhoneOptions prop */}
            {(patientPhoneOptions || []).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option> 
            ))}
        </Form.Select>

         <Form.Control
                    type="text"
                    name="patientPH"
                    value={formData.patientPH}
                    onChange={handleChange}
                    placeholder="Phone Number"
                    required
                    className={`form-control ${!formData.patientPH ? 'is-invalid' : ''}`}

                />
                <Form.Control
                    type="text"
                    name="patientEmail"
                    value={formData.patientEmail}
                    onChange={handleChange}
                    placeholder="Email Address"
                    required
                    className={`form-control ${!formData.patientEmail ? 'is-invalid' : ''}`}

                />
            </div>
            <Form.Label>Purpose of Medical Information Release</Form.Label>
            <Form.Select
                name="CarePurposeMedicalInformationRelease"
                value={formData.CarePurposeMedicalInformationRelease}
                onChange={(e) => {
                    const selectedType = e.target.value;
                    setFormData(prev => ({
                        ...prev,
                        CarePurposeMedicalInformationRelease: selectedType,
                        PurposeFurtherCare: selectedType === 'Further Treatment' ? prev.PurposeFurtherCare : '',
                        PurposePersonal: selectedType === 'Personal' ? prev.PurposePersonal : '',
                        PurposeAttorney: selectedType === 'Attorney' ? prev.PurposeAttorney : '',
                        PurposeOther: selectedType === 'Other' ? prev.PurposeOther : '',
                    }));
                }}
                required
                className={`form-control ${!formData.CarePurposeMedicalInformationRelease ? 'is-invalid' : ''}`}
            >
                <option value="" disabled>Release Information</option>
                {(purposeOptions || []).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </Form.Select>
        {formData.CarePurposeMedicalInformationRelease === 'Other' && (
            <Form.Control
                type="text"
                name="patientMedInfoReleaseOther"
                value={formData.patientMedInfoReleaseOther}
                onChange={handleChange}
                placeholder="Add a different release reason (Ex: Insurance / Courts)"
                required
                className={`form-control ${!formData.patientMedInfoReleaseOther ? 'is-invalid' : ''}`}

            />
        )}

            <Form.Label>Format of Medical Information Release </Form.Label>
            <Form.Select
            name="PurposeMedicalInformationReleaseFormat"
            value={formData.PurposeMedicalInformationReleaseFormat}
            onChange={(e) => {
                const selectedType = e.target.value;
                setFormData(prev => ({
                    ...prev,
                    PurposeMedicalInformationReleaseFormat: selectedType,
                    CopyofRecords: selectedType === 'CopyofRecords' ? prev.CopyofRecords : '',
                    VerbalRelease: selectedType === 'VerbalRelease' ? prev.VerbalRelease : '',
                    ElectronicRelease: selectedType === 'ElectronicRelease' ? prev.ElectronicRelease : '',
                    Other: selectedType === 'Other' ? prev.Other : '',
                }));
            }}
            required
            className={`form-control ${!formData.PurposeMedicalInformationReleaseFormat ? 'is-invalid' : ''}`}
        >
            <option value="" disabled>Release Information</option>
            {/* Updated to use formatOptions prop */}
            {(formatOptions || []).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </Form.Select>
         {formData.PurposeMedicalInformationReleaseFormat === 'Other' && (
            <Form.Control
                type="text"
                name="patientMedInfoFormatOther"
                value={formData.patientMedInfoFormatOther}
                onChange={handleChange}
                placeholder="Add a different release option (Ex: FAX)"
                required
                className={`form-control ${!formData.patientMedInfoFormatOther ? 'is-invalid' : ''}`}

            />
        )}
          <Form.Label>Record Release Time Frame </Form.Label>

        <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    type="text"
                    name="StupidDateFrom"
                    value={formData.StupidDateFrom}
                    onChange={handleChange}
                    placeholder="Treatment Date From"
                    required
                    className={`form-control ${!formData.StupidDateFrom ? 'is-invalid' : ''}`}
                />
                <Form.Control
                type="text"
                name="StupidDateTo"
                value={formData.StupidDateTo}
                onChange={handleChange}
                placeholder="Treatment Date To"
                required
                className={`form-control ${!formData.StupidDateTo ? 'is-invalid' : ''}`}
                />
            </div>

            <Form.Label>Medical Records to be Released </Form.Label>
            <Select
                    isMulti
                    name="MedicalRecordsRelease"
                    // Updated to use medicalRecordOptions prop for options
                    // The value logic remains the same, checking against formData
                    value={(medicalRecordOptions || []).filter(option =>
                        formData.MedicalRecordsRelease?.includes(option.value)
                    )}
                        onChange={(selectedOptions) => {
                        setFormData(prev => ({
                            ...prev,
                            MedicalRecordsRelease: selectedOptions ? selectedOptions.map(option => option.value) : []
                        }));
                    }}
                    options={medicalRecordOptions || []} // Updated to use medicalRecordOptions prop
                    className={`form-control ${!formData.MedicalRecordsRelease || formData.MedicalRecordsRelease.length === 0 ? 'is-invalid' : ''}`}
                    placeholder="Select Release Options (Multiple Choice)"
                    styles={{
                        control: (base, state) => ({ 
                            ...base,
                            minHeight: '38px',
                            backgroundColor: '#16202c',
                            color: '#eeeeeeb0',
                            borderColor: !formData.MedicalRecordsRelease || formData.MedicalRecordsRelease.length === 0 ? '#dc3545' : '#6c757d',
                            '&:hover': {
                                borderColor: !formData.MedicalRecordsRelease || formData.MedicalRecordsRelease.length === 0 ? '#dc3545' : '#eeeeeeb0'
                            }
                        }),
                        menu: (base) => ({
                            ...base,
                            backgroundColor: '#16202c',
                            zIndex: 1000,
                            border: '1px solid #6c757d',
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
                        })
                    }}
            />
                        {approximateCost > 0 && (
                <Form.Label style={{ marginTop: '5px', color: '#28a745', fontWeight: 'bold' }}>
                    This service will cost approximately ${approximateCost.toLocaleString()}
                </Form.Label>
            )}
            {approximateCost > 0 && ( 
                <Form.Group className="mb-3" style={{ marginTop: '15px' }}>
                    <Form.Check
                        type="checkbox"
                        id="payNowCheckbox"
                        label=" Pay Now?"
                        checked={formData.payNow === true || formData.payNow === 'true'} 
                        onChange={(e) => {
                            setFormData(prev => ({
                                ...prev,
                                payNow: e.target.checked, 
                            }));
                        }}
                    />
                    <span className="helper-text">
                        Tick this box if you wish to provide proof of payment now. Routing: <a href="https://banking.gta.world/transfer" target="_blank" rel="noopener noreferrer">020000062</a>
                    </span>
                </Form.Group>
            )}

            {(formData.payNow === true || formData.payNow === 'true') && approximateCost > 0 && (
                <Form.Group className="mb-3 upload-container">
                    <Form.Label>Proof of Payment Image Upload</Form.Label>
                    <InputGroup>
                        <Form.Control
                            as="textarea" 
                            rows={2}
                            name="paymentProofPhotos"
                            value={formData.paymentProofPhotos || ''}
                            onChange={handleChange} 
                            placeholder="Paste image URL or Upload"
                            required 
                            className={`form-control ${!formData.paymentProofPhotos ? 'is-invalid' : ''}`}
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
                                        handleImageUpload({ target: { files: [file] } }, 'paymentProofPhotos');
                                        e.preventDefault();
                                        break;
                                    }
                                }
                                if (containsUrl && !hasImageItem) {
                                    const currentValue = formData.paymentProofPhotos || '';
                                    const cursorPos = e.target.selectionStart;
                                    const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                                    const newValue = currentValue.slice(0, cursorPos) +
                                        (cursorPos > 0 ? separator : '') +
                                        pastedData +
                                        currentValue.slice(cursorPos);
                                    setFormData(prev => ({ ...prev, paymentProofPhotos: newValue }));
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
                                input.onchange = (e) => handleImageUpload(e, 'paymentProofPhotos');
                                input.click();
                            }}
                        >
                            <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                            {isUploading ? ' Uploading...' : ' Upload Image(s)'}
                        </Button>
                    </InputGroup>
                    <span className="helper-text">
                        Upload proof of payment. Supports clipboard pasting (Ctrl+V). Hosted by ImgBB.
                    </span>
                    {formData.paymentProofPhotos && formData.paymentProofPhotos.split(',').map((url, index) => (
                         url.trim() && <img key={index} src={url.trim()} alt={`Payment Proof ${index + 1}`} style={{ maxWidth: '100px', maxHeight: '100px', marginTop: '5px', marginRight: '5px', border: '1px solid #30363d' }} />
                    ))}
                </Form.Group>
            )}
                                                <Form.Label></Form.Label>

            {formData.MedicalRecordsRelease && formData.MedicalRecordsRelease.includes('Other') && (
            <Form.Control
                type="text"
                name="MedicalRecordsReleaseOther"
                value={formData.MedicalRecordsReleaseOther}
                onChange={handleChange}
                placeholder="Please specify other records to be released"
                required
                className={`form-control ${!formData.MedicalRecordsReleaseOther ? 'is-invalid' : ''}`} 
            />
        )}
            <Form.Label></Form.Label>
            <Form.Label>Practitioner Seen By:</Form.Label> 
    <Select
            name="phmcEmployee"
            value={phmcGroupedOptions
                .flatMap(group => group.options)
                .find(option => option.value === formData.phmcEmployee) || null}
            onChange={(selectedOption) => {
                handleChange({
                    target: {
                        name: 'phmcEmployee',
                        value: selectedOption?.value || ''
                    }
                });
                if (selectedOption) {
                    setFormData(prev => ({
                        ...prev,
                        phmcSignature: selectedOption.signature || ''
                    }));
                } else {
                    setFormData(prev => ({
                        ...prev,
                        phmcSignature: ''
                    }));
                }
            }}
            options={phmcGroupedOptions}
            isClearable
            placeholder="Which Doctor Treated You? (You can type to search!)"
            className="form-control" 
            styles={{ 
                control: (base) => ({
                    ...base,
                    backgroundColor: '#16202c',
                    color: '#eeeeeeb0',
                    borderColor: '#6c757d',
                    '&:hover': {
                        borderColor: '#eeeeeeb0'
                    }
                }),
                menu: (base) => ({
                    ...base,
                    backgroundColor: '#16202c',
                    zIndex: 1000
                }),
                option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isFocused ? 'Grey' : '#16202c',
                    color: '#eeeeeeb0'
                }),
                singleValue: (base) => ({
                    ...base,
                    color: '#eeeeeeb0'
                }),
                input: (base) => ({
                    ...base,
                    color: '#eeeeeeb0'
                }),
                placeholder: (base) => ({
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
            }}
        />
            <Form.Label></Form.Label>

            <Form.Label>Authorization For Release Information</Form.Label>
            <Form.Control
type="date"
name="SubmitDate"
value={formData.SubmitDate || new Date().toISOString().split('T')[0]}
onChange={handleChange}
readOnly 
className="form-control" 
/>

</>
    );
};

export default MedicalRelease;
