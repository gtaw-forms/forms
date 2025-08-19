import React, { useState, useMemo, useEffect } from 'react';
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
    showNotification,
    coronerList,
    isLoadingData
}) => {
    const [actionType, setActionType] = useState('addCoroner');
    const [employeeType, setEmployeeType] = useState('coroner');
    const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
    const [newRank, setNewRank] = useState('');
    const [staffToRemove, setStaffToRemove] = useState([]);
    const [authorizedBy, setAuthorizedBy] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [refreshData, setRefreshData] = useState(false); //refresh data

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
useEffect(() => {
        if (actionType === 'editUser' && selectedEmployeeName) {
            setIsLoading(true);
            let listRef;

            if (employeeType === 'coroner') {
                listRef = ref(database, 'staff/coroner');
            } else if (employeeType === 'hospitalStaff') {
                listRef = ref(database, 'staff/phmc');
            }

            get(listRef)
                .then((snapshot) => {
                    if (snapshot.exists()) {
                        const staffList = snapshot.val();
                        const employeeData = staffList.find(emp => emp.name === selectedEmployeeName);

                        if (employeeData) {
                            setMissingEmployeeData({
                                coronerName: employeeData.name || '',
                                coronerDiscord: employeeData.discord || '',
                                employeeLastName: employeeData.lastName || '',
                                coronerRank: employeeData.rank || '',
                                coronerPHNumber: employeeData.phNumber || '',
                                coronerBadge: employeeData.badge || '',
                            });
                        } else {
                            showNotification('Employee data not found.', 'warning');
                        }
                    } else {
                        showNotification('No employee data available.', 'warning');
                    }
                })
                .catch((error) => {
                    console.error("Error fetching employee data:", error);
                    showNotification(`Failed to fetch employee data: ${error.message}`, 'error');
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, [actionType, selectedEmployeeName, employeeType, showNotification, refreshData]);

  const handleSubmit = async () => {
        setIsLoading(true);
        let listRef;

        if (actionType === 'addEmployee') {
            const isCoroner = employeeType === 'coroner';
            const requiredFields = isCoroner
                ? { coronerName: 'Coroner Name', coronerDiscord: 'Discord', coronerRank: 'Rank', coronerBadge: 'Badge' }
                : { coronerName: 'First Name', employeeLastName: 'Last Name', coronerRank: 'Rank' };

            const emptyFields = Object.keys(requiredFields).filter(key => !missingEmployeeData[key]?.trim());

            if (emptyFields.length > 0) {
                const fieldNames = emptyFields.map(key => requiredFields[key]).join(', ');
                showNotification(`Please fill in all required fields: ${fieldNames}`, 'warning');
                setIsLoading(false);
                return;
            }

            const newStaffMemberName = isCoroner 
                ? missingEmployeeData.coronerName 
                : `${missingEmployeeData.coronerName} ${missingEmployeeData.employeeLastName}`.trim();

            const newStaffMember = isCoroner ? {
                name: newStaffMemberName,
                discord: missingEmployeeData.coronerDiscord,
                rank: missingEmployeeData.coronerRank,
                badge: missingEmployeeData.coronerBadge,
                phNumber: missingEmployeeData.coronerPHNumber || "",
                category: missingEmployeeData.coronerRank,
            } : {
                name: newStaffMemberName,
                lastName: missingEmployeeData.employeeLastName,
                rank: missingEmployeeData.coronerRank,
                category: missingEmployeeData.coronerRank,
            };

            listRef = ref(database, isCoroner ? 'staff/coroner' : 'staff/phmc');

            try {
                const snapshot = await get(listRef);
                const currentStaff = snapshot.exists() ? snapshot.val() : [];

                const isDuplicate = currentStaff.some(member => member.name.toLowerCase() === newStaffMember.name.toLowerCase());
                if (isDuplicate) {
                    showNotification(`Staff member with name "${newStaffMember.name}" already exists.`, 'warning');
                    setIsLoading(false);
                    return;
                }

                const updatedStaff = [...currentStaff, newStaffMember];
                await set(listRef, updatedStaff);

                await handleMissingEmployeeSubmit(actionType, employeeType, newStaffMember.name, null, [], authorizedBy, missingEmployeeData, updatedStaff);
                showNotification(`Successfully added ${newStaffMember.name} to the ${isCoroner ? 'coroner' : 'hospital staff'} list.`, 'success');
                
                setRefreshData(prev => !prev); // Refresh data
                // Clear form after successful submission
                setMissingEmployeeData({
                    coronerName: '',
                    coronerDiscord: '',
                    employeeLastName: '',
                    coronerRank: '',
                    coronerPHNumber: '',
                    coronerBadge: '',
                });

            } catch (error) {
                console.error(`Error adding staff member to Firebase:`, error);
                showNotification(`Error adding staff member: ${error.message}`, 'error');
            } finally {
                setIsLoading(false);
            }
        }
 else if (actionType === 'editUser') {
        if (!selectedEmployeeName) {
            console.error('No employee selected for edit.');
            setIsLoading(false);
            showNotification('No employee selected for edit.', 'warning');
            return;
        }

        let listRef;

        if (employeeType === 'coroner') {
            listRef = ref(database, 'staff/coroner');
        } else if (employeeType === 'hospitalStaff') {
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
                        // update name based on employee type
                        if (employeeType === 'coroner') {
                            employee.name = missingEmployeeData.coronerName;
                            employee.discord = missingEmployeeData.coronerDiscord;
                            employee.rank = missingEmployeeData.coronerRank;
                            employee.badge = missingEmployeeData.coronerBadge;
                            employee.phNumber = missingEmployeeData.coronerPHNumber;
                        } else {
                            employee.name = missingEmployeeData.coronerName; // First name
                            employee.lastName = missingEmployeeData.employeeLastName; // Last name
                            employee.rank = missingEmployeeData.coronerRank;
                        }
                        return employee;
                    }
                    return employee;
                });

                if (!employeeFound) {
                    console.error(`Employee "${selectedEmployeeName}" not found in the database.`);
                    setIsLoading(false);
                    showNotification(`Employee "${selectedEmployeeName}" not found in the database.`, 'error');
                    return;
                }

                await set(listRef, updatedStaff);

                // Filter to get only the updated employee
                const updatedEmployee = updatedStaff.find(emp => emp.name === selectedEmployeeName);

                // Log the updated employee data
                console.log('Updated Employee Data:', updatedEmployee);

                await handleMissingEmployeeSubmit(actionType, employeeType, selectedEmployeeName, newRank, staffToRemove, authorizedBy, missingEmployeeData, updatedEmployee);
                showNotification(`Successfully updated information for ${selectedEmployeeName}.`, 'success');
                setSelectedEmployeeName(''); // Clear the selected employee name
                setRefreshData(!refreshData);

            } else {
                console.error('No employee data found in the database.');
                showNotification('No employee data found in the database.', 'error');
            }
        } catch (error) {
            console.error("Error updating employee information in Firebase:", error);
            showNotification(`Error updating employee information: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }

    } else if (actionType === 'removeStaff') {
        if (!staffToRemove || staffToRemove.length === 0) {
            console.error('No staff members selected for removal.');
            setIsLoading(false);
            showNotification('No staff members selected for removal.', 'warning');
            return;
        }

        if (!authorizedBy?.trim()) {
            console.error('Authorization is required for staff removal.');
            setIsLoading(false);
            showNotification('Authorization is required for staff removal.', 'warning');
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
                showNotification(`Successfully removed ${staffToRemove.length} staff member(s).`, 'success');

            } else {
                console.error('No staff data found in the database.');
                showNotification('No staff data found in the database.', 'error');
            }
        } catch (error) {
            console.error('Error removing staff members from Firebase:', error);
            showNotification(`Error removing staff members: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }

} else if (actionType === 'updateRank') {
        if (!selectedEmployeeName || !newRank) {
            // Handle cases where employee or rank is not selected/entered
            setIsLoading(false);
            showNotification('Please select an employee and enter a new rank.', 'warning');
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
                       const newStaffMember =  { ...employee, rank: trimmedNewRank, category: trimmedNewRank };
                        return newStaffMember;
                    }
                    return employee;
                });

                if (!employeeFound) {
                    console.error(`Employee "${selectedEmployeeName}" not found in the database.`);
                    setIsLoading(false);
                    showNotification(`Employee "${selectedEmployeeName}" not found in the database.`, 'error');
                    return;
                }

                await set(listRef, updatedStaff);
            handleMissingEmployeeSubmit(actionType, employeeType, selectedEmployeeName, newRank, staffToRemove, authorizedBy, missingEmployeeData, updatedStaff);
            showNotification(`Successfully added ${selectedEmployeeName} to the ${employeeType === 'coroner' ? 'coroner' : 'hospital staff'} list.`, 'success');
                setRefreshData(!refreshData);


            }
        } catch (error) {
            console.error("Error updating employee rank in Firebase:", error);
            showNotification(`Error updating employee rank: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
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
                                        label="Add Employee"
                                        name="actionType"
                                        type="radio"
                                        id={`addEmployee-radio`}
                                        value="addEmployee"
                                        checked={actionType === 'addEmployee'}
                                        onChange={() => handleActionTypeChange('addEmployee')}
                                    />
                                <Form.Check
                                        inline
                                        label="Change Employee Details"
                                        name="actionType"
                                        type="radio"
                                        id={`editUser-radio`}
                                        value="editUser"
                                        checked={actionType === 'editUser'}
                                        onChange={() => handleActionTypeChange('editUser')}
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
                                </div>
                            </Form.Group>

                            {(actionType === 'addEmployee' || actionType === 'updateRank') && (
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

                            {(actionType === 'addEmployee') && (
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
{actionType === 'editUser' && (
    <>
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

        {employeeType === 'coroner' ? (
            <>
                <Form.Group controlId="newCoronerNameInput" className="mb-3">
                    <Form.Label style={formLabelStyle}>Enter Updated Coroner Name</Form.Label>
                    <Form.Control
                        type="text"
                        placeholder="Enter updated coroner name..."
                        value={missingEmployeeData.coronerName}
                        onChange={handleInputChange}
                        name="coronerName"
                        disabled={!selectedEmployeeName}
                        style={formControlStyle}
                    />
                </Form.Group>
                <Form.Group controlId="newCoronerDiscordInput" className="mb-3">
                    <Form.Label style={formLabelStyle}>Enter Updated Coroner Discord</Form.Label>
                    <Form.Control
                        type="text"
                        placeholder="Enter updated coroner discord..."
                        value={missingEmployeeData.coronerDiscord}
                        onChange={handleInputChange}
                        name="coronerDiscord"
                        disabled={!selectedEmployeeName}
                        style={formControlStyle}
                    />
                </Form.Group>
                <Form.Group controlId="newCoronerRankInput" className="mb-3">
                    <Form.Label style={formLabelStyle}>Enter Updated Coroner Rank</Form.Label>
                    <Form.Control
                        type="text"
                        placeholder="Enter updated coroner rank..."
                        value={missingEmployeeData.coronerRank}
                        onChange={handleInputChange}
                        name="coronerRank"
                        disabled={!selectedEmployeeName}
                        style={formControlStyle}
                    />
                </Form.Group>
                <Form.Group controlId="newCoronerBadgeInput" className="mb-3">
                    <Form.Label style={formLabelStyle}>Enter Updated Coroner Badge</Form.Label>
                    <Form.Control
                        type="text"
                        placeholder="Enter updated coroner badge..."
                        value={missingEmployeeData.coronerBadge}
                        onChange={handleInputChange}
                        name="coronerBadge"
                        disabled={!selectedEmployeeName}
                        style={formControlStyle}
                    />
                </Form.Group>
                <Form.Group controlId="newCoronerPHNumberInput" className="mb-3">
                    <Form.Label style={formLabelStyle}>Enter Updated Coroner PH Number</Form.Label>
                    <Form.Control
                        type="text"
                        placeholder="Enter updated coroner ph number..."
                        value={missingEmployeeData.coronerPHNumber}
                        onChange={handleInputChange}
                        name="coronerPHNumber"
                        disabled={!selectedEmployeeName}
                        style={formControlStyle}
                    />
                </Form.Group>
            </>
        ) : (
            <>
                <Form.Group controlId="newHospitalFirstNameInput" className="mb-3">
                    <Form.Label style={formLabelStyle}>Enter Updated First Name</Form.Label>
                    <Form.Control
                        type="text"
                        placeholder="Enter updated first name..."
                        value={missingEmployeeData.coronerName}
                        onChange={handleInputChange}
                        name="coronerName"
                        disabled={!selectedEmployeeName}
                        style={formControlStyle}
                    />
                </Form.Group>
                <Form.Group controlId="newHospitalLastNameInput" className="mb-3">
                    <Form.Label style={formLabelStyle}>Enter Updated Last Name</Form.Label>
                    <Form.Control
                        type="text"
                        placeholder="Enter updated last name..."
                        value={missingEmployeeData.employeeLastName}
                        onChange={handleInputChange}
                        name="employeeLastName"
                        disabled={!selectedEmployeeName}
                        style={formControlStyle}
                    />
                </Form.Group>
                <Form.Group controlId="newHospitalRankInput" className="mb-3">
                    <Form.Label style={formLabelStyle}>Enter Updated Rank</Form.Label>
                    <Form.Control
                        type="text"
                        placeholder="Enter updated rank..."
                        value={missingEmployeeData.coronerRank}
                        onChange={handleInputChange}
                        name="coronerRank"
                        disabled={!selectedEmployeeName}
                        style={formControlStyle}
                    />
                </Form.Group>
            </>
        )}
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
                                {employeeType === 'coroner' ? (
                                    <Form.Control
                                        type="text"
                                        placeholder="Enter updated rank name..."
                                        value={newRank}
                                        onChange={handleNewRankChange}
                                        disabled={!selectedEmployeeName}
                                        style={formControlStyle}
                                    />
                                ) : (
                                    <Form.Control
                                        type="text"
                                        placeholder="Enter updated position name..."
                                        value={newRank}
                                        onChange={handleNewRankChange}
                                        disabled={!selectedEmployeeName}
                                        style={formControlStyle}
                                    />
                                )}
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
