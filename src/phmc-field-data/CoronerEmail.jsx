import React, { useEffect, useState } from 'react';
import { useData } from '../contexts/DataContext.jsx';
import { Form, Button } from 'react-bootstrap';
import { recordInputInteraction } from '../index';
import EmployeeCredentialsSection from '../components/EmployeeCredentialsSection';

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

    // Enhanced handleChange to record input interactions for error reporting
    const handleChangeWithContext = (e) => {
        const { name, type } = e.target;
        let inputType = 'text'; // default

        if (type === 'checkbox') inputType = 'checkbox';
        else if (type === 'radio') inputType = 'radio';
        else if (type === 'select-one') inputType = 'select';
        else if (type === 'textarea') inputType = 'textarea';

        recordInputInteraction(inputType, name);
        handleChange(e);
    };

    // Enhanced handleReportChange to record input interactions
    const handleReportChangeWithContext = (index, value) => {
        recordInputInteraction('textarea', `additionalReport_${index}`);
        handleReportChange(index, value);
    };


    return (
        <>
            <p>Please attach the reports, adding them in manually will NOT automatically change the BBCode. </p>

            <EmployeeCredentialsSection 
                formData={formData}
                setFormData={setFormData}
                groupedOptions={coronerGroupedOptions}
                handleSelectChange={handleSelectChange}
                setShowEmployeeModal={setShowEmployeeModal}
                employeeType="coroner"
                context="CoronerEmail"
            />
            <Form.Label></Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    type="text"
                    name="requestingOfficer"
                    value={formData.requestingOfficer}
                    onChange={handleChangeWithContext}
                    placeholder="Requesting Officer Name"
                    required
                    className={`form-control ${!formData.requestingOfficer ? 'is-invalid' : ''}`}
                    />
            <Form.Select
                name="department"
                value={formData.department}
                onChange={handleChangeWithContext}
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
    onChange={handleChangeWithContext}
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
                                        onChange={handleChangeWithContext}
                                        placeholder="Decedent's IC name"
                                        required
                                        className={`form-control ${!formData.decedentName ? 'is-invalid' : ''}`}
                                    />
                                    <Form.Control
                                    type="text"
                                    name="decedentOOC"
                                    value={formData.decedentOOC}
                                    onChange={handleChangeWithContext}
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
                                    onChange={handleChangeWithContext}
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
                            onChange={(e) => handleReportChangeWithContext(index, e.target.value)}
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