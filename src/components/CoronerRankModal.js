// filepath: src/components/CoronerRankModal.js
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
};
// --- End Styles ---

const CoronerRankModal = ({
    show,
    onClose,
    onSubmit, // This will be used for the webhook notification from App.js
    coronerList = [],
    setCoronerListData, // New prop to update App.js state
    showNotification   // New prop for showing notifications
}) => {
    const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
    const [newRank, setNewRank] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (show) {
            // Reset state when modal becomes visible
            if (coronerList.length > 0 && !selectedEmployeeName) {
                 // Optionally pre-select if desired, or leave empty
                // setSelectedEmployeeName(coronerList[0].name);
            } else if (coronerList.length === 0) {
                setSelectedEmployeeName('');
            }
            setNewRank('');
            setIsSubmitting(false);
        }
    }, [show, coronerList, selectedEmployeeName]);

    const handleSubmit = async () => {
        const trimmedNewRank = newRank.trim();

        if (!selectedEmployeeName) {
            showNotification('Please select a coroner employee.', 'warning');
            return;
        }

        // If newRank is empty, just trigger the onSubmit for potential webhook (e.g., "employee selected")
        // and close. No DB update.
        if (!trimmedNewRank) {
            if (onSubmit) {
                onSubmit({ selectedEmployee: selectedEmployeeName, newRank: '' });
            }
            onClose();
            return;
        }

        setIsSubmitting(true);
        const coronerListRef = ref(database, 'staff/coroner');

        try {
            const snapshot = await get(coronerListRef);
            if (snapshot.exists()) {
                let currentCoroners = snapshot.val();
                let coronerFound = false;

                const updatedCoroners = currentCoroners.map(coroner => {
                    if (coroner.name === selectedEmployeeName) {
                        coronerFound = true;
                        return { ...coroner, rank: trimmedNewRank, category: trimmedNewRank }; // Update rank and category
                    }
                    return coroner;
                });

                if (!coronerFound) {
                    showNotification(`Coroner "${selectedEmployeeName}" not found in the database.`, 'error');
                    Sentry.captureMessage(`CoronerRankModal: Attempted to update non-existent coroner "${selectedEmployeeName}"`);
                    setIsSubmitting(false);
                    return;
                }

                await set(coronerListRef, updatedCoroners);
                setCoronerListData(updatedCoroners); // Update state in App.js
                showNotification(`Rank for ${selectedEmployeeName} updated to "${trimmedNewRank}" in the database.`, 'check-circle');

                if (onSubmit) { // Trigger webhook via App.js's handler
                    onSubmit({ selectedEmployee: selectedEmployeeName, newRank: trimmedNewRank });
                }
                onClose();

            } else {
                showNotification('No coroner data found in the database.', 'error');
                Sentry.captureMessage("CoronerRankModal: staff/coroner path does not exist in Firebase.");
            }
        } catch (error) {
            console.error("Error updating coroner rank in Firebase:", error);
            Sentry.captureException(error, { extra: { context: 'CoronerRankModal Firebase Update', selectedEmployeeName, newRank } });
            showNotification('Failed to update coroner rank in database. Please try again.', 'error');
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

    const employeeOptions = coronerList.map(emp => ({
        value: emp.name,
        label: `${emp.name} (${emp.rank || 'Rank Missing'})`
    }));

    if (!show) {
        return null;
    }

    return (
        <div style={modalOverlayStyle} onClick={onClose}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                <div style={modalHeaderStyle}>
                    <h5 style={modalTitleStyle}>Update Coroner Rank</h5>
                    <button onClick={onClose} style={closeButtonStyle} aria-label="Close modal">
                        &times;
                    </button>
                </div>

                <div style={modalBodyStyle}>
                    <Form>
                        <Form.Group controlId="coronerEmployeeSelect" className="mb-3">
                            <Form.Label style={formLabelStyle}>Pick Coroner</Form.Label>
                            <Select
                                name="coronerEmployeeSelect"
                                aria-label="Select Coroner Employee"
                                options={employeeOptions}
                                value={employeeOptions.find(option => option.value === selectedEmployeeName)}
                                onChange={handleSelectChange}
                                styles={reactSelectStyles}
                                isDisabled={employeeOptions.length === 0 || isSubmitting}
                                isClearable
                                placeholder="Search or select coroner employee..."
                                classNamePrefix="react-select"
                            />
                        </Form.Group>

                        <div className="text-center my-2" style={{ color: '#6c757d' }}></div>

                        <Form.Group controlId="newCoronerRankInput" className="mb-3">
                        <Form.Label style={formLabelStyle}>Enter Updated Rank for Selected Coroner</Form.Label>
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
