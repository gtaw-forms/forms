// filepath: src/components/CoronerRankModal.js
import React, { useState, useEffect } from 'react';
import { Button, Form } from 'react-bootstrap';
import Select from 'react-select'; // <-- Import react-select

// --- Styles ---
const modalOverlayStyle = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1050,
};
const modalContentStyle = {
    backgroundColor: '#0d1117', color: '#c9d1d9', padding: '20px',
    borderRadius: '5px', width: '90%',
    maxWidth: '750px', // <-- Increased from 450px
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
// Removed formSelectStyle as it's not used with react-select directly here
const formLabelStyle = {
    color: '#c9d1d9',
    marginBottom: '8px', // Keep or adjust bottom margin as needed
    marginTop: '10px',   // <-- Added top margin for spacing above
    display: 'block',
};
// --- Styles for react-select ---
const reactSelectStyles = {
    control: (base) => ({
        ...base,
        backgroundColor: '#0d1117', // Dark background
        color: '#c9d1d9',           // Light text
        borderColor: '#30363d',     // Subtle border
        '&:hover': {
            borderColor: '#c9d1d9' // Lighter border on hover
        }
    }),
    menu: (base) => ({
        ...base,
        backgroundColor: '#0d1117', // Dark menu background
        zIndex: 1051 // Ensure menu is above modal content
    }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isFocused ? '#1f2937' : '#0d1117', // Darker/lighter on focus
        color: '#c9d1d9',
        '&:hover': {
            backgroundColor: '#1f2937' // Background on hover
        }
    }),
    singleValue: (base) => ({
        ...base,
        color: '#c9d1d9' // Light text for selected value
    }),
    input: (base) => ({
        ...base,
        color: '#c9d1d9' // Light text for input/search
    }),
    placeholder: (base) => ({
        ...base,
        color: '#6c757d' // Dimmer placeholder text
    }),
};
// --- End Styles ---

const CoronerRankModal = ({
    show,
    onClose,
    onSubmit,
    coronerList = []
}) => {
    const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
    const [newRank, setNewRank] = useState('');

    useEffect(() => {
        if (show) {
            setSelectedEmployeeName(coronerList.length > 0 ? coronerList[0].name : '');
            setNewRank('');
        }
    }, [show, coronerList]);

    const handleSubmit = () => {
        const valueToSend = newRank.trim() !== '' ? newRank.trim() : selectedEmployeeName;
        if (valueToSend) {
            onSubmit(valueToSend);
        } else {
            console.warn("No employee selected or new rank entered.");
        }
    };

    const handleSelectChange = (selectedOption) => {
        const employeeName = selectedOption ? selectedOption.value : '';
        setSelectedEmployeeName(employeeName);
        if (newRank !== '') {
            setNewRank('');
        }
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
                                isDisabled={employeeOptions.length === 0}
                                isClearable
                                placeholder="Search or select coroner employee..."
                                classNamePrefix="react-select"
                            />
                        </Form.Group>

                        <div className="text-center my-2" style={{ color: '#6c757d' }}></div>

                        <Form.Group controlId="newCoronerRankInput" className="mb-3">
                            <Form.Label style={formLabelStyle}>Updated Coroner Rank</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Enter updated rank name..."
                                value={newRank}
                                onChange={handleNewRankChange}
                                style={formControlStyle}
                            />
                        </Form.Group>
                    </Form>
                </div>

                <div style={modalFooterStyle}>
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSubmit}>
                        <i className="fas fa-paper-plane"></i> Submit Info
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CoronerRankModal;
