import React, { useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { Form, Button } from 'react-bootstrap';
import Select from 'react-select';
import { getFormDefinition } from '../formDefinitions'; // Import getFormDefinition

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

const CoronerEmail = ({ // Renamed component to follow PascalCase convention
    formData,
    handleChange,
    setFormData, // <-- Make sure setFormData is passed as a prop
    handleSelectChange, // Added this prop
    setShowEmployeeModal,
    coronerGroupedOptions,
    handleFillCoronerPhone,
    fillPhoneChecked,
    setFillPhoneChecked,
    addReport,
    removeReport,
    handleReportChange,
    toggleSavedReports 
}) => {

    // Get agencyDataStore from context
    const { agencyDataStore, isLoadingData } = useData();

    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            decedentName: '',
            decedentOOC: ''
        }));
    }, [setFormData]);


    return (
        <>
            <p>Please be careful when Attaching Reports, it may take some time to process. Also attaching reports will automatically add the decedent name and decedent OOC!!!</p>

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
                                        <i className="fas fa-question-circle" style={{ marginRight: '5px' }}></i> {/* Changed icon */}
                                        Missing Name?
                                    </button>

                                </div>
                            <Select
                                    name="coronerEmployee"
                                    value={coronerGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.coronerEmployee) || null}
                onChange={(selectedOption, actionMeta) => handleSelectChange(selectedOption, actionMeta)}
                                    options={coronerGroupedOptions}
                                    isClearable
                                    placeholder="Search or select coroner..."
                                    className={`form-control ${!formData.coronerEmployee ? 'is-invalid' : ''}`}
                                styles={customSelectStyles}
                                />
                                <Form.Label></Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Control
                                        type="text"
                                        name="requestingOfficer"
                                        value={formData.requestingOfficer}
                                        onChange={handleChange}
                                        placeholder="Requesting Officer Name"
                                        required
                                        className={`form-control ${!formData.requestingOfficer ? 'is-invalid' : ''}`}
                                        />
                                <Form.Select
                                    name="department"
                                    value={formData.department}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.department ? 'is-invalid' : ''}`}
                                    disabled={isLoadingData || !agencyDataStore || Object.keys(agencyDataStore).length === 0}
                                >
                                    <option value="" disabled>
                                        {isLoadingData ? 'Loading departments...' : 'Select Department'}
                                    </option>
                                    {agencyDataStore && Object.entries(agencyDataStore).map(([key, agency]) => (
                                        <option key={key} value={key}>
                                            {agency.fullName || key}
                                        </option>
                                    ))}
                                </Form.Select>
</div>
<Form.Group className="mb-3">
    <Form.Label>
        Coroner Contact Number:
    </Form.Label>
    {/* Keep the input field */}
    <Form.Control
        type="text"
        name="coronerPHNumber"
        value={formData.coronerPHNumber}
        onChange={handleChange}
        required
        placeholder="Coroner Phone Number"
        className={`form-control ${!formData.coronerPHNumber ? 'is-invalid' : ''}`}
    />
</Form.Group>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="decedentName"
                                            value={formData.decedentName}
                                            onChange={handleChange}
                                            placeholder="Decedent's IC name"
                                            required
                                            className={`form-control ${!formData.decedentName ? 'is-invalid' : ''}`}
                                        />
                                        <Form.Control
                                        type="text"
                                        name="decedentOOC"
                                        value={formData.decedentOOC}
                                        onChange={handleChange}
                                        placeholder="Decedent's OOC name"
                                        required
                                        className={`form-control ${!formData.decedentOOC ? 'is-invalid' : ''}`}
                                        />
                                    </div>

                                <Form.Group className="mb-3">
                                    <Form.Label>Paste Form BBCode:</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="deathReport"
                                        value={formData.deathReport}
                                        onChange={handleChange}
                                        placeholder="Paste Paperwork (Death Report, Mass Fatality) BBCode here"
                                        rows="2"
                                        className={`form-control ${!formData.deathReport ? 'is-invalid' : ''}`}

                                    />
                                </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label>Additional Reports:</Form.Label>
                <div className="reports-container">
                    {(formData.additionalReports || []).map((report, index) => (
                        <div key={index} className="report-input">
                            <Form.Control
                                as="textarea"
                                value={report}
                                onChange={(e) => handleReportChange(index, e.target.value)}
                                placeholder="Paste additional coroner report here"
                                rows="4"
                                className={`form-control ${!report ? 'is-invalid' : ''}`}
                            />
                            <Button
                                variant="danger"
                                onClick={() => removeReport(index)}
                                className="remove-report-button"
                            >
                                Remove Report
                            </Button>
                        </div>
                    ))}
                    <div className="email-buttons">
                        <Button
                            variant="primary"
                            onClick={addReport}
                            className="add-report-button"
                        >
                            Add Another Report
                        </Button>

                        <Button
                            variant="info"
                            onClick={() => toggleSavedReports([1, 11], 'Coroner', (reportData) => {
                                console.log('Selected report data:', reportData);
                                // Update the deathReport field with the selected report's BBCode
                                if (reportData && reportData.bbCode) {
                                    handleChange({
                                        target: {
                                            name: 'deathReport',
                                            value: reportData.bbCode
                                        }
                                    });
                                }
                            })}
                            className="email-button"
                        >
                            <i className="fas fa-save"></i> Attach Paperwork (Death Reports, Mass Fatality)
                        </Button>

                    </div>

                </div>
            </Form.Group>
        </>
    );
};
export default CoronerEmail;