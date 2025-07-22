import React, { useState, useMemo } from 'react';
import { Form, Button } from 'react-bootstrap';
import Select from 'react-select';
import { database } from '../firebase'; // Corrected path
import { ref, get, set } from 'firebase/database';

// --- Styles ---
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

const MissingEmployeeModal = ({
    show,
    onHide,
    phmcList,
    handleMissingEmployeeSubmit,
    coronerListData,
    coronerList,
}) => {
    const [actionType, setActionType] = useState('addCoroner');
    const [employeeType, setEmployeeType] = useState('coroner');
    const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
    const [newRank, setNewRank] = useState('');
    const [staffToRemove, setStaffToRemove] = useState([]);
    const [authorizedBy, setAuthorizedBy] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [missingEmployeeData, setMissingEmployeeData] = useState({
        coronerName: '',
        coronerDiscord: '',
        employeeLastName: '',
        coronerRank: '',
        coronerPHNumber: '',
        coronerBadge: '',
    });

    const handleActionTypeChange = (type) => {
        setActionType(type);
        setSelectedEmployeeName('');
        setNewRank('');
        setEmployeeType(type === 'addPhmc' ? 'hospitalStaff' : 'coroner');
    };

    const handleEmployeeTypeChange = (type) => {
        setEmployeeType(type);
        setSelectedEmployeeName('');
        setNewRank('');
    };

    const handleSelectChange = (selectedOption) => {
        setSelectedEmployeeName(selectedOption ? selectedOption.value : '');
        setNewRank(''); // Explicitly set newRank to an empty string
    };

    const handleNewRankChange = (e) => {
        setNewRank(e.target.value);
    };

    const handleRemoveStaffChange = (selectedOptions) => {
        setStaffToRemove(selectedOptions ? selectedOptions.map(option => option.value) : []);
    };

    const handleAuthorizedByChange = (e) => {
        setAuthorizedBy(e.target.value);
    };

    const handleInputChange = (e) => {
        setMissingEmployeeData({ ...missingEmployeeData, [e.target.name]: e.target.value });
    };

const handleSubmit = async () => {
    setIsLoading(true);
    let listRef;

    if (actionType === 'addCoroner' || actionType === 'addPhmc') {
        const isCoroner = actionType === 'addCoroner';
        const requiredFields = isCoroner
            ? ['coronerName', 'coronerDiscord', 'coronerRank', 'coronerBadge']
            : ['coronerName', 'employeeLastName', 'coronerRank'];
        
        const emptyFields = requiredFields.filter(key => !missingEmployeeData[key]?.trim());
        if (emptyFields.length > 0) {
            console.error(`Missing required fields: ${emptyFields.join(', ')}`);
            setIsLoading(false);
            return; // Stop further execution
        }

        const newStaffMember = isCoroner ? {
            name: missingEmployeeData.coronerName,
            discord: missingEmployeeData.coronerDiscord,
            rank: missingEmployeeData.coronerRank,
            badge: missingEmployeeData.coronerBadge,
            phNumber: missingEmployeeData.coronerPHNumber || "",
            category: missingEmployeeData.coronerRank, // Consistent with CoronerRankModal
        } : {
            name: missingEmployeeData.coronerName,
            lastName: missingEmployeeData.employeeLastName,
            rank: missingEmployeeData.coronerRank,
            category: missingEmployeeData.coronerRank, // Consistent with CoronerRankModal
        };

        listRef = ref(database, isCoroner ? 'staff/coroner' : 'staff/phmc');

        try {
            const snapshot = await get(listRef);
            let currentStaff = snapshot.exists() ? snapshot.val() : [];
            
            // Check for duplicate (you may need to adjust the criteria)
            const isDuplicate = currentStaff.some(member => member.name === newStaffMember.name);
            if (isDuplicate) {
                console.error(`Staff member with name "${newStaffMember.name}" already exists.`);
                setIsLoading(false);
                return;
            }

            const updatedStaff = [...currentStaff, newStaffMember];
            await set(listRef, updatedStaff);

            // Update local state or trigger a refresh if needed
            handleMissingEmployeeSubmit(actionType, employeeType, selectedEmployeeName, newRank, staffToRemove, authorizedBy, missingEmployeeData, updatedStaff);

        } catch (error) {
            console.error(`Error adding staff member to Firebase:`, error);
        } finally {
            setIsLoading(false);
        }

    } else if (actionType === 'removeStaff') {
        if (!staffToRemove || staffToRemove.length === 0) {
            console.error('No staff members selected for removal.');
            setIsLoading(false);
            return;
        }

        if (!authorizedBy?.trim()) {
            console.error('Authorization is required for staff removal.');
            setIsLoading(false);
            return;
        }

        listRef = ref(database, 'staff');  // Operate on both lists
        try {
            const snapshot = await get(listRef);
            if (snapshot.exists()) {
                let staffData = snapshot.val();
                let coronerStaff = staffData.coroner || [];
                let phmcStaff = staffData.phmc || [];

                // Filter out removed staff
                const updatedCoronerStaff = coronerStaff.filter(member => !staffToRemove.includes(member.name));
                const updatedPhmcStaff = phmcStaff.filter(member => !staffToRemove.includes(member.name));

                await set(listRef, { coroner: updatedCoronerStaff, phmc: updatedPhmcStaff });
                
                handleMissingEmployeeSubmit(actionType, employeeType, selectedEmployeeName, newRank, staffToRemove, authorizedBy, missingEmployeeData, {
                    coroner: updatedCoronerStaff,
                    phmc: updatedPhmcStaff,
                });

            } else {
                console.error('No staff data found in the database.');
            }
        } catch (error) {
            console.error('Error removing staff members from Firebase:', error);
        } finally {
            setIsLoading(false);
        }

    } else if (actionType === 'updateRank') {
        if (!selectedEmployeeName || !newRank) {
            // Handle cases where employee or rank is not selected/entered
            setIsLoading(false);
            return;
        }
        
        const trimmedNewRank = newRank.trim();

        if (employeeType === 'coroner') {
            listRef = ref(database, 'staff/coroner');
        } else if (employeeType === 'hospitalStaff'){
            listRef = ref(database, 'staff/phmc');
        }

        try {
            const snapshot = await get(listRef);
            if (snapshot.exists()) {
                let currentStaff = snapshot.val();
                let employeeFound = false;

                const updatedStaff = currentStaff.map(employee => {
                    if (employee.name === selectedEmployeeName) {
                        employeeFound = true;
                        // Update both 'rank' and 'category' to ensure consistency
                        return { ...employee, rank: trimmedNewRank, category: trimmedNewRank };
                    }
                    return employee;
                });

                if (!employeeFound) {
                    console.error(`Employee "${selectedEmployeeName}" not found in the database.`);
                    setIsLoading(false);
                    return;
                }

                await set(listRef, updatedStaff);
                 // Update state in App.js if you have a mechanism to pass this data back
                handleMissingEmployeeSubmit(actionType, employeeType, selectedEmployeeName, newRank, staffToRemove, authorizedBy, missingEmployeeData, updatedStaff);
                
            } else {
                console.error('No employee data found in the database.');
            }
        } catch (error) {
            console.error("Error updating employee rank in Firebase:", error);
        } finally {
            setIsLoading(false);
        }
    } else {
        handleMissingEmployeeSubmit(actionType, employeeType, selectedEmployeeName, newRank, staffToRemove, authorizedBy, missingEmployeeData);
        setIsLoading(false);
    }
};

    const handleClose = () => {
        if (typeof onHide === 'function') {
            onHide();
        } else {
            console.error('MissingEmployeeModal: onHide is not a function', onHide);
        }
    };

    const employeeOptions = useMemo(() => {
        let options = [];
        if (employeeType === 'coroner') {
            options = coronerList.map(emp => ({
                value: emp.name,
                label: `${emp.name} (${emp.rank || emp.category || 'Rank Missing'})`
            }));
        } else if (employeeType === 'hospitalStaff') {
            options = phmcList.map(emp => ({
                value: emp.name,
                label: `${emp.name} (${emp.rank || emp.category || 'Rank Missing'})`
            }));
        }
        return options;
    }, [employeeType, coronerList, phmcList]);

const combinedStaffOptions = useMemo(() => {
    let coronerOptions = [];
    let phmcOptions = [];

    if (Array.isArray(coronerList)) {
        coronerOptions = coronerList.map(c => ({
            value: c.name,
            label: `${c.name} (${c.rank || 'Coroner'})`,
            category: 'Coroner Staff', // Added category
        }));
    }

    if (Array.isArray(phmcList)) {
        phmcOptions = phmcList.map(p => ({
            value: p.name,
            label: `${p.name} (${p.category || 'PHMC'})`,
            category: 'Hospital Staff', // Added category
        }));
    }
    
    // Combine and then sort by category for better readability
    return [...coronerOptions, ...phmcOptions].sort((a, b) => a.category.localeCompare(b.category));
}, [coronerList, phmcList]);

    return (
        show ? (
            <div style={modalOverlayStyle} onClick={handleClose}>
                <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                    <div style={modalHeaderStyle}>
                        <h5 style={modalTitleStyle}>Manage Employee Data</h5>
                        <button onClick={handleClose} style={closeButtonStyle} aria-label="Close modal">
                            &times;
                        </button>
                    </div>
                    <div style={modalBodyStyle}>
                        <Form>
                            <Form.Group controlId="actionTypeRadios" className="mb-3">
                                <Form.Label style={formLabelStyle}>Select Action:</Form.Label>
                                <div key={`inline-radio`} className="mb-3">
                                    <Form.Check
                                        inline
                                        label="Add Coroner"
                                        name="actionType"
                                        type="radio"
                                        id={`addCoroner-radio`}
                                        value="addCoroner"
                                        checked={actionType === 'addCoroner'}
                                        onChange={() => handleActionTypeChange('addCoroner')}
                                    />
                                    <Form.Check
                                        inline
                                        label="Add Hospital Staff"
                                        name="actionType"
                                        type="radio"
                                        id={`addPhmc-radio`}
                                        value="addPhmc"
                                        checked={actionType === 'addPhmc'}
                                        onChange={() => handleActionTypeChange('addPhmc')}
                                    />
                                    <Form.Check
                                        inline
                                        label="Remove Staff"
                                        name="actionType"
                                        type="radio"
                                        id={`removeStaff-radio`}
                                        value="removeStaff"
                                        checked={actionType === 'removeStaff'}
                                        onChange={() => handleActionTypeChange('removeStaff')}
                                    />
                                    <Form.Check
                                        inline
                                        label="Update Rank"
                                        name="actionType"
                                        type="radio"
                                        id={`updateRank-radio`}
                                        value="updateRank"
                                        checked={actionType === 'updateRank'}
                                        onChange={() => handleActionTypeChange('updateRank')}
                                    />
                                </div>
                            </Form.Group>

                            {(actionType === 'addCoroner' || actionType === 'addPhmc' || actionType === 'updateRank') && (
                                <Form.Group controlId="employeeTypeRadios" className="mb-3">
                                    <Form.Label style={formLabelStyle}>Select Employee Type:</Form.Label>
                                    <div key={`inline-radio-employee`} className="mb-3">
                                        <Form.Check
                                            inline
                                            label="Coroner"
                                            name="employeeType"
                                            type="radio"
                                            id={`coroner-radio`}
                                            value="coroner"
                                            checked={employeeType === 'coroner'}
                                            onChange={() => handleEmployeeTypeChange('coroner')}
                                        />
                                        <Form.Check
                                            inline
                                            label="Hospital Staff"
                                            name="employeeType"
                                            type="radio"
                                            id={`hospitalStaff-radio`}
                                            value="hospitalStaff"
                                            checked={employeeType === 'hospitalStaff'}
                                            onChange={() => handleEmployeeTypeChange('hospitalStaff')}
                                        />
                                    </div>
                                </Form.Group>
                            )}

                            {(actionType === 'addCoroner' || actionType === 'addPhmc') && (
                                <>
                                    {employeeType === 'coroner' && (
                                        <>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <Form.Control
                                                    type="text"
                                                    name="coronerName"
                                                    value={missingEmployeeData.coronerName}
                                                    onChange={handleInputChange}
                                                    placeholder="Coroner Name"
                                                    required
                                                    style={formControlStyle}
                                                />
                                                <Form.Control
                                                    type="text"
                                                    name="coronerDiscord"
                                                    value={missingEmployeeData.coronerDiscord}
                                                    onChange={handleInputChange}
                                                    placeholder="Coroner Discord Name"
                                                    required
                                                    style={formControlStyle}
                                                />
                                                <Form.Control
                                                    type="text"
                                                    name="coronerRank"
                                                    value={missingEmployeeData.coronerRank}
                                                    onChange={handleInputChange}
                                                    placeholder="Coroner Rank / Position"
                                                    required
                                                    style={formControlStyle}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                                <Form.Control
                                                    type="text"
                                                    name="coronerPHNumber"
                                                    value={missingEmployeeData.coronerPHNumber}
                                                    onChange={handleInputChange}
                                                    placeholder="Coroner PH number (Optional)"
                                                    style={formControlStyle}
                                                />
                                                <Form.Control
                                                    type="text"
                                                    name="coronerBadge"
                                                    value={missingEmployeeData.coronerBadge}
                                                    onChange={handleInputChange}
                                                    placeholder="Coroner Badge Number"
                                                    required
                                                    style={formControlStyle}
                                                />
                                            </div>
                                        </>
                                    )}
                                    {employeeType === 'hospitalStaff' && (
                                        <>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <Form.Control
                                                    type="text"
                                                    name="coronerName"
                                                    value={missingEmployeeData.coronerName}
                                                    onChange={handleInputChange}
                                                    placeholder="Employee First Name"
                                                    required
                                                    style={formControlStyle}
                                                />
                                                <Form.Control
                                                    type="text"
                                                    name="employeeLastName"
                                                    value={missingEmployeeData.employeeLastName}
                                                    onChange={handleInputChange}
                                                    placeholder="Employee Last Name"
                                                    required
                                                    style={formControlStyle}
                                                />
                                                <Form.Control
                                                    type="text"
                                                    name="coronerRank"
                                                    value={missingEmployeeData.coronerRank}
                                                    onChange={handleInputChange}
                                                    placeholder="Employee Rank / Position"
                                                    required
                                                    style={formControlStyle}
                                                />
                                            </div>
                                        </>
                                    )}
                                </>
                            )}

                            {actionType === 'removeStaff' && (
                                <>
                                    <Form.Label style={formLabelStyle}>Staff to Remove:</Form.Label>
                                    <Select
                                        isMulti
                                        name="staffToRemove"
                                        options={combinedStaffOptions}
                                        value={combinedStaffOptions.filter(option => staffToRemove.includes(option.value))}
                                        onChange={handleRemoveStaffChange}
                                        isClearable
                                        placeholder="Select staff member(s) to remove..."
                                        styles={reactSelectStyles}
                                        className="mb-2"
                                    />
                                    <Form.Label style={formLabelStyle}>Authorized By:</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="authorizedBy"
                                        value={authorizedBy}
                                        onChange={handleAuthorizedByChange}
                                        placeholder="Your Name (Authorizing Removal)"
                                        required
                                        style={formControlStyle}
                                    />
                                    <span className="helper-text" style={{ color: '#6c757d', display: 'block', marginTop: '5px' }}> (Only authorized personnel should submit removal requests.)</span>
                                </>
                            )}

                            {actionType === 'updateRank' && (
                                <>
                                    <Form.Group controlId="coronerEmployeeSelect" className="mb-3">
                                        <Form.Label style={formLabelStyle}>Select Employee</Form.Label>
                                        <Select
                                            name="coronerEmployeeSelect"
                                            options={employeeOptions}
                                            value={employeeOptions.find(option => option.value === selectedEmployeeName)}
                                            onChange={handleSelectChange}
                                            isClearable
                                            placeholder="Search or select employee..."
                                            styles={reactSelectStyles}
                                        />
                                    </Form.Group>
                                    <Form.Group controlId="newCoronerRankInput" className="mb-3">
                                        <Form.Label style={formLabelStyle}>Enter Updated Rank</Form.Label>
                                        <Form.Control
                                            type="text"
                                            placeholder="Enter updated rank name..."
                                            value={newRank}
                                            onChange={handleNewRankChange}
                                            disabled={!selectedEmployeeName}
                                            style={formControlStyle}
                                        />
                                    </Form.Group>
                                </>
                            )}
                        </Form>
                    </div>
                    <div style={modalFooterStyle}>
                        <Button variant="primary" onClick={handleSubmit} disabled={isLoading}>
                            Submit Request
                        </Button>
                        <Button variant="secondary" onClick={handleClose}>
                            Cancel
                        </Button>
                    </div>
                </div>
            </div>
        ) : null
    );
};

export default MissingEmployeeModal;
