import React from 'react';
import { Form, Button } from 'react-bootstrap';
import Select from 'react-select';

const CoronerEmail = ({ // Renamed component to follow PascalCase convention
    formData,
    handleChange,
    handleSelectChange, // Added this prop
    setShowMissingEmployeeModal,
    setShowCoronerRankModal, // Added this prop
    coronerGroupedOptions,
    handleFillCoronerPhone,
    fillPhoneChecked,
    setFillPhoneChecked,
    addReport,
    removeReport,
    handleReportChange,
    parseBBCode,
}) => {
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
                                        <i className="fas fa-question-circle" style={{ marginRight: '5px' }}></i> {/* Changed icon */}
                                        Missing Name?
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowCoronerRankModal(true)} // <-- Open CoronerRankModal
                                        className="close-button" // Keep class or change if needed
                                        style={{
                                            padding: '0.25rem 0.5rem',
                                            fontSize: '0.8rem',
                                            lineHeight: '1.2'
                                        }}
                                        title="Select or Add Coroner Rank" // <-- Update title
                                    >
                                        <i className="fas fa-user-md" style={{ marginRight: '5px' }}></i> {/* <-- Update icon */}
                                        Update Coroner Rank {/* <-- Update text */}
                                    </button>

                                </div>
                                                               <Select
                                    name="coronerEmployee"
                                    value={coronerGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.coronerEmployee) || null}
                                    onChange={(selectedOption) => handleSelectChange(selectedOption, 'coroner')}
                                    options={coronerGroupedOptions}
                                    isClearable
                                    placeholder="Search or select coroner..."
                                    className={`form-control ${!formData.coronerEmployee ? 'is-invalid' : ''}`}
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
                                    >
                                        <option value="" disabled>Select Department</option>
                                        <option value="LSFD">LSFD</option>
                                        <option value="LSPD">LSPD</option>
                                        <option value="LSSD">LSSD</option>
                                        <option value="PHMC">PHMC</option>
                                        <option value="SANFIRE">SANFIRE</option>
                                        <option value="SADCR">SADCR</option>
                                        <option value="LSGOV">LSGOV</option>
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '8px' }}>
        {/* Checkbox trigger */}
        <Form.Check
    type="checkbox"
    id="fillCoronerPhoneCheckbox"
    label="  Use selected coroner's phone number"
    // Ensure fillPhoneChecked is treated as a boolean
    checked={!!fillPhoneChecked}
    onChange={(e) => {
        // Your existing onChange logic is fine as e.target.checked is boolean
        if (e.target.checked) {
            handleFillCoronerPhone();
            setFillPhoneChecked(true);
        } else {
            setFillPhoneChecked(false);
        }
    }}
/>

        {/* Missing Name Button */}
        <button
            type="button"
            onClick={() => setShowMissingEmployeeModal(true)}
            className="close-button" // You might want a different class/style for this button
            style={{
                padding: '0.1rem 0.1rem',
                fontSize: '0.8rem',
                lineHeight: '1.2',
                marginLeft: 'auto' // Pushes the button to the right if desired
            }}
            title="Report missing employee data" // Added tooltip
        >
            <i className="fas fa-question-circle" style={{ marginRight: '2px' }}></i>
            Missing Number?
        </button>
    </div>

    <span className="helper-text">
        (Defaults to PHMC Landline. Check the box to fill from selected coroner.)
    </span>
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
                                    <Form.Label>Paste Death Report BBCode:</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="deathReport"
                                        value={formData.deathReport}
                                        onChange={handleChange}
                                        placeholder="Paste Death Report"
                                        rows="2"
                                        className={`form-control ${!formData.deathReport ? 'is-invalid' : ''}`}

                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Additional Reports:</Form.Label>
                                    <div className="reports-container">
                                        {formData.additionalReports.map((report, index) => (
                                            <div key={index} className="report-input">
                                                <Form.Control
                                                    as="textarea"
                                                    value={report}
                                                    onChange={(e) => handleReportChange(index, e.target.value)}
                                                    placeholder="Paste additional coroner report here"
                                                    rows="4"
                                                    className={`form-control ${!formData.additionalReports ? 'is-invalid' : ''}`}
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
                                                variant="success"
                                                onClick={addReport}
                                                className="email-button"
                                            >
                                                <i className="fas fa-plus"></i> Add Report
                                            </Button>
                                            <Button
                                                variant="primary"
                                                onClick={parseBBCode}
                                                className="email-button"
                                            >
                                                <i className="fas fa-copy"></i> Parse BBCode
                                            </Button>
                                        </div>

                                    </div>
                                </Form.Group>
        </>
    );
};

export default CoronerEmail; // Export with PascalCase name
