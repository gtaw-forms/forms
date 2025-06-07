import React from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import Select from 'react-select';

const MissingEmployeeModal = ({
    show,
    onHide,
    isJohnDoe,
    isJaneDoe,
    isRemoveStaff,
    handleDoeChange,
    handleRemoveStaffChange,
    missingEmployeeData,
    handleMissingEmployeeChange,
    phmcGroupedOptions,
    coronerGroupedOptions,
    combinedStaffOptions,
    handleMissingEmployeeSubmit,
}) => {
    if (!show) {
        return null;
    }

    return (
        <div className="modal-overlay">
            <div className="modal">
                <Modal.Header>
                    <Modal.Title>Manage Employee Data</Modal.Title>
                    <Button variant="secondary" className="close" onClick={onHide}>
                        <span>CLOSE</span>
                    </Button>
                </Modal.Header>
                <div className="radio-inline-container">
                    <span className="radio-text">Action:</span>
                    <Form.Check
                        type="radio"
                        id="addCoronerRadio"
                        label="  Add Coroner"
                        name="requestTypeGroup"
                        checked={isJohnDoe}
                        onChange={handleDoeChange('john')}
                        inline
                    />
                    <Form.Check
                        type="radio"
                        id="addPhmcRadio"
                        label="  Add Hospital Staff"
                        name="requestTypeGroup"
                        checked={isJaneDoe}
                        onChange={handleDoeChange('jane')}
                        inline
                    />
                    <Form.Check
                        type="radio"
                        id="removeStaffRadio"
                        label="  Remove Staff"
                        name="requestTypeGroup"
                        checked={isRemoveStaff}
                        onChange={handleRemoveStaffChange}
                        inline
                    />
                </div>

                <Modal.Body>
                    <Form>
                        {/* Conditional rendering based on isJohnDoe, isJaneDoe, isRemoveStaff */}
                        {isJohnDoe && (
                            <>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Control type="text" name="coronerName" value={missingEmployeeData.coronerName} onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerName')} placeholder='Coroner Name' required />
                                    <Form.Control type="text" name="coronerDiscord" value={missingEmployeeData.coronerDiscord} onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerDiscord')} placeholder='Coroner Discord Name' required />
                                    <Form.Control type="text" name="coronerRank" value={missingEmployeeData.coronerRank} onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerRank')} placeholder='Coroner Rank / Position' required />
                                </div>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    <Form.Control type="text" name="coronerPHNumber" value={missingEmployeeData.coronerPHNumber} onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerPHNumber')} placeholder='Coroner PH number (Optional)' />
                                    <Form.Control type="text" name="coronerBadge" value={missingEmployeeData.coronerBadge} onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerBadge')} placeholder='Coroner Badge Number (Required***)' required />
                                </div>
                                <Select
                                    name="coronerEmployee" // This is the REQUESTER
                                    value={missingEmployeeData.coronerEmployee ? coronerGroupedOptions.flatMap(group => group.options).find(option => option.value === missingEmployeeData.coronerEmployee) || null : null}
                                    onChange={(selectedOption) => handleMissingEmployeeChange(selectedOption?.value || '', 'coronerEmployee')}
                                    options={coronerGroupedOptions}
                                    isClearable
                                    placeholder="Who is requesting this addition..."
                                    className="form-control mt-2"
                                    styles={{
                                        control: (base) => ({ ...base, backgroundColor: '#16202c', color: '#eeeeeeb0', borderColor: '#30363d', '&:hover': { borderColor: '#30363d' } }),
                                        menu: (base) => ({ ...base, backgroundColor: '#16202c', zIndex: 1000 }),
                                        option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? 'Grey' : '#16202c', color: '#eeeeeeb0' }),
                                        singleValue: (base) => ({ ...base, color: '#eeeeeeb0' }),
                                        input: (base) => ({ ...base, color: '#eeeeeeb0' }),
                                        placeholder: (base) => ({ ...base, color: '#eeeeeeb0' })
                                    }}
                                />
                            </>
                        )}

                        {isJaneDoe && (
                            <>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Control type="text" name="coronerName" value={missingEmployeeData.coronerName} onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerName')} placeholder='First Name and Last Name' required />
                                    <Form.Control type="text" name="employeeLastName" value={missingEmployeeData.employeeLastName} onChange={(e) => handleMissingEmployeeChange(e.target.value, 'employeeLastName')} placeholder='Employee Last Name' required />
                                    <Form.Control type="text" name="coronerRank" value={missingEmployeeData.coronerRank} onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerRank')} placeholder='Employee Rank / Position' required />
                                </div>
                                <Select
                                    name="phmcEmployee" // This is the REQUESTER
                                    value={missingEmployeeData.phmcEmployee ? phmcGroupedOptions.flatMap(group => group.options).find(option => option.value === missingEmployeeData.phmcEmployee) || null : null}
                                    onChange={(selectedOption) => handleMissingEmployeeChange(selectedOption?.value || '', 'phmcEmployee')}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Who is requesting this addition..."
                                    className="form-control mt-2"
                                    styles={{
                                        control: (base) => ({ ...base, backgroundColor: '#16202c', color: '#eeeeeeb0', borderColor: '#30363d', '&:hover': { borderColor: '#30363d' } }),
                                        menu: (base) => ({ ...base, backgroundColor: '#16202c', zIndex: 1000 }),
                                        option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? 'Grey' : '#16202c', color: '#eeeeeeb0' }),
                                        singleValue: (base) => ({ ...base, color: '#eeeeeeb0' }),
                                        input: (base) => ({ ...base, color: '#eeeeeeb0' }),
                                        placeholder: (base) => ({ ...base, color: '#eeeeeeb0' })
                                    }}
                                />
                            </>
                        )}

                        {isRemoveStaff && (
                            <>
                                <Form.Label>Staff to Remove:</Form.Label>
                                <Select
                                    isMulti
                                    name="staffToRemove"
                                    options={combinedStaffOptions}
                                    value={combinedStaffOptions.flatMap(group => group.options).filter(option => missingEmployeeData.staffToRemove.includes(option.value))}
                                    onChange={(selectedOptions) => {
                                        const selectedValues = selectedOptions ? selectedOptions.map(option => option.value) : [];
                                        handleMissingEmployeeChange(selectedValues, 'staffToRemove');
                                    }}
                                    isClearable
                                    placeholder="Select staff member(s) to remove..."
                                    className="form-control mb-2"
                                    styles={{
                                        control: (base) => ({ ...base, minHeight: '38px', backgroundColor: '#16202c', color: '#eeeeeeb0', borderColor: '#6c757d', '&:hover': { borderColor: '#eeeeeeb0' } }),
                                        menu: (base) => ({ ...base, backgroundColor: '#16202c', zIndex: 1000, border: '1px solid #6c757d', borderRadius: '0.375rem' }),
                                        option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#30363d' : '#16202c', color: '#eeeeeeb0', padding: '0.5rem 1rem', '&:hover': { backgroundColor: '#30363d' } }),
                                        multiValue: (base) => ({ ...base, backgroundColor: '#30363d', color: '#eeeeeeb0' }),
                                        multiValueLabel: (base) => ({ ...base, color: '#eeeeeeb0' }),
                                        multiValueRemove: (base) => ({ ...base, color: '#6c757d', '&:hover': { backgroundColor: '#dc3545', color: '#fff' } }),
                                        input: (base) => ({ ...base, color: '#eeeeeeb0' }),
                                        placeholder: (base) => ({ ...base, color: '#6c757d' })
                                    }}
                                />
                                <Form.Label>Authorized By:</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="authorizedBy"
                                    value={missingEmployeeData.authorizedBy}
                                    onChange={(e) => handleMissingEmployeeChange(e.target.value, 'authorizedBy')}
                                    placeholder='Your Name (Authorizing Removal)'
                                    required
                                />
                                <span className="helper-text">
                                    (Only authorized personnel should submit removal requests.)
                                </span>
                            </>
                        )}
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="primary" onClick={handleMissingEmployeeSubmit}>
                        Submit Request
                    </Button>
                    <Button variant="secondary" className="close" onClick={onHide}>
                        Cancel
                    </Button>
                </Modal.Footer>
            </div>
        </div>
    );
};

export default MissingEmployeeModal;
