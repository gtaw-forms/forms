// src/saaa-components/SaaaEmployeeModal.js
import React, { useState, useEffect } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import Select from 'react-select';

const SaaaEmployeeModal = ({
    show,
    onHide,
    saaaGroupedOptions, // For 'requesting this addition' and 'staff to remove'
    handleSaaaEmployeeSubmit, // Submission handler in App.js
    showNotification, // For displaying notifications
}) => {
    const [isAddMode, setIsAddMode] = useState(true); // Default to Add mode
    const [employeeData, setEmployeeData] = useState({
        employeeName: '',
        employeeRank: '',
        employeePhoneNumber: '', // Optional
        requester: '', // SAAA employee requesting the addition
        staffToRemove: [],
        authorizedBy: '',
    });

    useEffect(() => {
        // Reset form when modal is shown or mode changes
        if (show) {
            setEmployeeData({
                employeeName: '',
                employeeRank: '',
                employeePhoneNumber: '',
                requester: '',
                staffToRemove: [],
                authorizedBy: '',
            });
            // Optionally, set isAddMode back to true every time modal opens
            // setIsAddMode(true);
        }
    }, [show]);

    const handleDataChange = (value, fieldName) => {
        setEmployeeData(prev => ({ ...prev, [fieldName]: value }));
    };

    const handleSubmit = () => {
        // Pass the current mode and employeeData to the handler in App.js
        handleSaaaEmployeeSubmit(isAddMode, employeeData);
    };

    // Styles for react-select (can be shared or customized)
    const selectStyles = {
        control: (base) => ({ ...base, backgroundColor: '#16202c', color: '#eeeeeeb0', borderColor: '#30363d', '&:hover': { borderColor: '#30363d' } }),
        menu: (base) => ({ ...base, backgroundColor: '#16202c', zIndex: 1060 }), // Ensure menu is above modal overlay
        option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? 'Grey' : '#16202c', color: '#eeeeeeb0' }),
        singleValue: (base) => ({ ...base, color: '#eeeeeeb0' }),
        input: (base) => ({ ...base, color: '#eeeeeeb0' }),
        placeholder: (base) => ({ ...base, color: '#eeeeeeb0' }),
        multiValue: (base) => ({ ...base, backgroundColor: '#30363d', color: '#eeeeeeb0' }),
        multiValueLabel: (base) => ({ ...base, color: '#eeeeeeb0' }),
        multiValueRemove: (base) => ({ ...base, color: '#6c757d', '&:hover': { backgroundColor: '#dc3545', color: '#fff' } }),
    };

    if (!show) {
        return null;
    }

    return (
        <div className="modal-overlay"> {/* Use existing modal overlay style from App.css or define here */}
            <div className="modal" style={{maxWidth: '600px'}}> {/* Use existing modal style or define here */}
                <Modal.Header>
                    <Modal.Title>Manage SAAA Employee Data</Modal.Title>
                    <Button variant="secondary" className="close" onClick={onHide}>
                        <span>CLOSE</span>
                    </Button>
                </Modal.Header>
                <div className="radio-inline-container" style={{ padding: '10px 20px' }}>
                    <span className="radio-text" style={{ marginRight: '10px' }}>Action:</span>
                    <Form.Check
                        type="radio"
                        id="addSaaaEmployeeRadio"
                        label=" Add SAAA Employee"
                        name="saaaRequestTypeGroup"
                        checked={isAddMode}
                        onChange={() => setIsAddMode(true)}
                        inline
                    />
                    <Form.Check
                        type="radio"
                        id="removeSaaaEmployeeRadio"
                        label=" Remove SAAA Employee"
                        name="saaaRequestTypeGroup"
                        checked={!isAddMode}
                        onChange={() => setIsAddMode(false)}
                        inline
                    />
                </div>

                <Modal.Body>
                    <Form>
                        {isAddMode && (
                            <>
                                <Form.Group className="mb-3">
                                    <Form.Label>Employee Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="employeeName"
                                        value={employeeData.employeeName}
                                        onChange={(e) => handleDataChange(e.target.value, 'employeeName')}
                                        placeholder="Enter full name"
                                        required
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Employee Rank/Position</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="employeeRank"
                                        value={employeeData.employeeRank}
                                        onChange={(e) => handleDataChange(e.target.value, 'employeeRank')}
                                        placeholder="Enter rank or position"
                                        required
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Employee Phone Number (Optional)</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="employeePhoneNumber"
                                        value={employeeData.employeePhoneNumber}
                                        onChange={(e) => handleDataChange(e.target.value, 'employeePhoneNumber')}
                                        placeholder="Enter phone number"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Who is requesting this addition?</Form.Label>
                                    <Select
                                        name="requester"
                                        value={saaaGroupedOptions?.flatMap(g => g.options).find(opt => opt.value === employeeData.requester) || null}
                                        onChange={(selectedOption) => handleDataChange(selectedOption?.value || '', 'requester')}
                                        options={saaaGroupedOptions || []}
                                        isClearable
                                        placeholder="Select SAAA employee..."
                                        styles={selectStyles}
                                        className="form-control p-0" // p-0 to remove react-bootstrap padding
                                        classNamePrefix="react-select"
                                    />
                                </Form.Group>
                            </>
                        )}

                        {!isAddMode && (
                            <>
                                <Form.Group className="mb-3">
                                    <Form.Label>SAAA Staff to Remove:</Form.Label>
                                    <Select
                                        isMulti
                                        name="staffToRemove"
                                        options={saaaGroupedOptions || []}
                                        value={saaaGroupedOptions?.flatMap(g => g.options).filter(opt => employeeData.staffToRemove.includes(opt.value)) || []}
                                        onChange={(selectedOptions) => {
                                            const selectedValues = selectedOptions ? selectedOptions.map(option => option.value) : [];
                                            handleDataChange(selectedValues, 'staffToRemove');
                                        }}
                                        isClearable
                                        placeholder="Select SAAA staff member(s)..."
                                        styles={selectStyles}
                                        className="form-control p-0"
                                        classNamePrefix="react-select"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Authorized By:</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="authorizedBy"
                                        value={employeeData.authorizedBy}
                                        onChange={(e) => handleDataChange(e.target.value, 'authorizedBy')}
                                        placeholder="Your Name (Authorizing Removal)"
                                        required
                                    />
                                    <Form.Text className="text-muted">
                                        Only authorized personnel should submit removal requests.
                                    </Form.Text>
                                </Form.Group>
                            </>
                        )}
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="primary" onClick={handleSubmit}>
                        Submit Request
                    </Button>
                    <Button variant="secondary" onClick={onHide}>
                        Cancel
                    </Button>
                </Modal.Footer>
            </div>
        </div>
    );
};

export default SaaaEmployeeModal;
