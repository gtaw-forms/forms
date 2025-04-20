import React from 'react';
import { Form } from 'react-bootstrap';
import Select from 'react-select';

const MedicalRelease = ({
    formData,
    handleChange,
    setFormData,
    patientTitle,
    patientPhone,
    PurposeMedicalInformationRelease,
    PurposeMedicalInformationReleaseFormat,
    MedicalRecordsRelease,
    phmcGroupedOptions,
}) => {
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
                    {patientTitle.map((option) => (
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
            {patientPhone.map((option) => (
                <option key={option.value} value={option.value}>{option.value}</option>
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
            {PurposeMedicalInformationRelease.map((option) => (
                <option key={option.value} value={option.value}>{option.value}</option>
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
            {PurposeMedicalInformationReleaseFormat.map((option) => (
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
                    value={formData.MedicalRecordsRelease ? MedicalRecordsRelease.filter(option =>
                        formData.MedicalRecordsRelease.includes(option.value)
                    ) : []}
                        onChange={(selectedOptions) => {
                        setFormData(prev => ({
                            ...prev,
                            MedicalRecordsRelease: selectedOptions ? selectedOptions.map(option => option.value) : []
                        }));
                    }}
                    options={MedicalRecordsRelease}
                    className={`form-control ${!formData.MedicalRecordsRelease ? 'is-invalid' : ''}`}
                    placeholder="Select Release Options (Multiple Choice)"
                    styles={{                                        
                        control: (base) => ({
                    ...base,
                    minHeight: '38px',
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
                                                <Form.Label></Form.Label>                                                               

            {formData.MedicalRecordsRelease && formData.MedicalRecordsRelease.includes('Other') && (
            <Form.Control
                type="text"
                name="MedicalRecordsReleaseOther"
                value={formData.MedicalRecordsReleaseOther}
                onChange={handleChange}
                placeholder="Please specify other records to be released"
                required
            />
        )}
            <Form.Label></Form.Label>                                                               
            <Form.Label></Form.Label>
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
/>

</>
    );
};
          
export default MedicalRelease;