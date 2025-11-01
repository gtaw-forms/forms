import React, { useState, useEffect } from 'react';
import { Button, Form } from 'react-bootstrap';
import Select from 'react-select';
import { database } from '../firebase'; // Corrected path
import { ref, get, set } from 'firebase/database';
import * as Sentry from "@sentry/react";

// --- Styles (Keep existing styles) ---
const modalOverlayStyle = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1050,
};
const modalContentStyle = {
    backgroundColor: '#0d1117', color: '#c9d1d9', padding: '20px',
    borderRadius: '5px', width: '90%',
    maxWidth: '750px', 
    maxHeight: '1500px', position: 'relative',
    border: '1px solid #30363d',
};
const modalHeaderStyle = {
    fontSize: '1.2em', fontWeight: 'bold', marginBottom: '15px',
    borderBottom: '1px solid #30363d', paddingBottom: '10px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    color: '#c9d1d9',
};
const modalTitleStyle = { margin: 0 };
const closeButtonStyle = {
    background: 'none', border: 'none', color: '#c9d1d9',
    fontSize: '24px', cursor: 'pointer', lineHeight: '1', padding: '0 5px',
};
const modalBodyStyle = { paddingTop: '10px' };
const modalFooterStyle = {
    borderTop: '1px solid #30363d', paddingTop: '15px', marginTop: '20px',
    display: 'flex', justifyContent: 'flex-end', gap: '10px',
};
const formControlStyle = {
    backgroundColor: '#0d1117', color: '#c9d1d9',
    borderColor: '#30363d', width: '100%',
};
const formLabelStyle = {
    color: '#c9d1d9',
    marginBottom: '8px', 
    marginTop: '10px',   
    display: 'block',
};
const reactSelectStyles = {
    control: (base) => ({
        ...base,
        backgroundColor: '#0d1117', 
        color: '#c9d1d9',           
        borderColor: '#30363d',     
        '&:hover': {
            borderColor: '#c9d1d9' 
        }
    }),
    menu: (base) => ({
        ...base,
        backgroundColor: '#0d1117', 
        zIndex: 1051 
    }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isFocused ? '#1f2937' : '#0d1117', 
        color: '#c9d1d9',
        '&:hover': {
            backgroundColor: '#1f2937' 
        }
    }),
    singleValue: (base) => ({
        ...base,
        color: '#c9d1d9' 
    }),
    input: (base) => ({
        ...base,
        color: '#c9d1d9' 
    }),
    placeholder: (base) => ({
        ...base,
        color: '#6c757d' 
    }),
        group: (base) => ({ ...base, paddingTop: 8, paddingBottom: 8 }),
    groupHeading: (base) => ({ ...base, color: '#6c757d', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: 4 })

};
// --- End Styles ---

const CoronerRankModal = ({
    show,
    onClose,
    onSubmit, // This will be used for the webhook notification from App.js
    coronerList = [],
    phmcList = [], // New prop for hospital staff list
    setCoronerListData, // New prop to update App.js state
    setPhmcListData,
    showNotification   // New prop for showing notifications
}) => {
    const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
    const [newRank, setNewRank] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [employeeType, setEmployeeType] = useState('coroner'); // 'coroner' or 'hospitalStaff'

    useEffect(() => {
        if (show) {
            // Reset state when modal becomes visible
            setSelectedEmployeeName('');
            setNewRank('');
            setIsSubmitting(false);
        }
    }, [show]);

    const handleSubmit = async () => {
        const trimmedNewRank = newRank.trim();

        if (!selectedEmployeeName) {
            showNotification('Please select an employee.', 'warning');
            return;
        }

        if (!trimmedNewRank) {
            if (onSubmit) {
                onSubmit({ selectedEmployee: selectedEmployeeName, newRank: '', employeeType: employeeType });
            }
            onClose();
            return;
        }

        setIsSubmitting(true);
        let listRef;
        let currentList;
        let updateFunction;

        if (employeeType === 'coroner') {
            listRef = ref(database, 'staff/coroner');
            currentList = coronerList;
            updateFunction = setCoronerListData;
        } else {
            listRef = ref(database, 'staff/phmc');
            currentList = phmcList;
            updateFunction = setPhmcListData;
        }

        try {
            const snapshot = await get(listRef);
            if (snapshot.exists()) {
                let currentStaff = snapshot.val();
                let employeeFound = false;

                const updatedStaff = currentStaff.map(employee => {
                    if (employee.name === selectedEmployeeName) {
                        employeeFound = true;
                        // Ensure both 'rank' and 'category' are updated for coroners
                        if (employeeType === 'coroner') {
                            return { ...employee, rank: trimmedNewRank, category: trimmedNewRank };
                        } else { // Hospital Staff, Ensure 'rank' is updated, as well as 'category'
                            return { ...employee, rank: trimmedNewRank, category: trimmedNewRank };
                        }
                    }
                    return employee;
                });

                if (!employeeFound) {
                    showNotification(`Employee "${selectedEmployeeName}" not found in the database.`, 'error');
                    Sentry.captureMessage(`CoronerRankModal: Attempted to update non-existent employee "${selectedEmployeeName}"`);
                    setIsSubmitting(false);
                    return;
                }

                await set(listRef, updatedStaff);
                updateFunction(updatedStaff); // Update state in App.js
                showNotification(`Rank for ${selectedEmployeeName} updated to "${trimmedNewRank}" in the database.`, 'check-circle');

                if (onSubmit) { // Trigger webhook via App.jsx's handler
                    onSubmit({ selectedEmployee: selectedEmployeeName, newRank: trimmedNewRank, employeeType: employeeType });
                }
                onClose();

            } else {
                showNotification('No employee data found in the database.', 'error');
                Sentry.captureMessage("CoronerRankModal: staff/coroner path does not exist in Firebase.");
            }
        } catch (error) {
            console.error("Error updating employee rank in Firebase:", error);
            Sentry.captureException(error, { extra: { context: 'CoronerRankModal Firebase Update', selectedEmployeeName, newRank, employeeType } });
            showNotification('Failed to update employee rank in database. Please try again.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSelectChange = (selectedOption) => {
        const employeeName = selectedOption ? selectedOption.value : '';
        setSelectedEmployeeName(employeeName);
    };

    const handleNewRankChange = (e) => {
        setNewRank(e.target.value);
    };

    const employeeOptions = (employeeType === 'coroner' ? coronerList : phmcList).map(emp => ({
        value: emp.name,
        label: `${emp.name} (${emp.rank || emp.category || 'Rank Missing'})`
    }));

    if (!show) {
        return null;
    }

    return (
        <div style={modalOverlayStyle} onClick={onClose}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                <div style={modalHeaderStyle}>
                    <h5 style={modalTitleStyle}>Update Employee Rank</h5>
                    <button onClick={onClose} style={closeButtonStyle} aria-label="Close modal">
                        &times;
                    </button>
                </div>

                <div style={modalBodyStyle}>
                    <Form>
                         <Form.Group controlId="employeeTypeRadios" className="mb-3">
                            <Form.Label style={formLabelStyle}>Select Employee Type</Form.Label>
                            <div key={`inline-radio`} className="mb-3">
                                <Form.Check
                                    inline
                                    label="Coroner"
                                    name="employeeType"
                                    type="radio"
                                    id={`coroner-radio`}
                                    value="coroner"
                                    checked={employeeType === 'coroner'}
                                    onChange={() => setEmployeeType('coroner')}
                                />
                                <Form.Check
                                    inline
                                    label="Hospital Staff"
                                    name="employeeType"
                                    type="radio"
                                    id={`hospitalStaff-radio`}
                                    value="hospitalStaff"
                                    checked={employeeType === 'hospitalStaff'}
                                    onChange={() => setEmployeeType('hospitalStaff')}
                                />
                            </div>
                        </Form.Group>
                        <Form.Group controlId="coronerEmployeeSelect" className="mb-3">
                            <Form.Label style={formLabelStyle}>Select Employee</Form.Label>
                            <Select
                                name="coronerEmployeeSelect"
                                aria-label="Select Coroner Employee"
                                options={employeeOptions}
                                value={employeeOptions.find(option => option.value === selectedEmployeeName)}
                                onChange={handleSelectChange}
                                styles={reactSelectStyles}
                                isDisabled={employeeOptions.length === 0 || isSubmitting}
                                isClearable
                                placeholder="Search or select employee..."
                                classNamePrefix="react-select"
                            />
                            {employeeOptions.length === 0 && (
                                <Form.Text className="text-muted">
                                    No employees found for selected type.  Please add employee to form first.
                                </Form.Text>
                            )}
                        </Form.Group>

                        <div className="text-center my-2" style={{ color: '#6c757d' }}></div>

                        <Form.Group controlId="newCoronerRankInput" className="mb-3">
                            <Form.Label style={formLabelStyle}>Enter Updated Rank</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Enter updated rank name..."
                                value={newRank}
                                onChange={handleNewRankChange}
                                style={formControlStyle}
                                disabled={!selectedEmployeeName || isSubmitting}
                            />
                        </Form.Group>
                    </Form>
                </div>

                <div style={modalFooterStyle}>
                    <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting || !selectedEmployeeName}>
                        {isSubmitting ? (
                            <>
                                <i className="fas fa-spinner fa-spin" style={{ marginRight: '5px' }}></i>
                                Submitting...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-paper-plane"></i> Submit Info
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CoronerRankModal;
