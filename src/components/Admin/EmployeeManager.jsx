
import './EmployeeManagerModal.css';
import './CctvRequestWebhookModal.css';
import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { database } from '../../firebase';
import { ref, get, set, update, remove } from 'firebase/database';
import { Table, Button, Form, Spinner, Alert } from 'react-bootstrap';
const EmployeeManager = () => {
    const [employees, setEmployees] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState(null);

    const fetchEmployees = useCallback(async () => {
        setLoading(true);
        console.log('[Debug] Fetching employees from Nursing_Records...');
        try {
            const recordsRef = ref(database, 'Nursing_Records');
            const snapshot = await get(recordsRef);
            if (snapshot.exists()) {
                const data = snapshot.val();
                const employeeData = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                console.log('[Debug] Fetched employees:', employeeData);
                setEmployees(employeeData);
            } else {
                console.log('[Debug] No employees found in Nursing_Records.');
                setEmployees([]);
            }
        } catch (err) {
            setError('Failed to fetch employees.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (editingEmployee) {
            setEditingEmployee(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleUpdateEmployee = async () => {
        if (!editingEmployee || !editingEmployee.name || !editingEmployee.surname) {
            setError('Name and surname are required.');
            return;
        }
        setLoading(true);
        try {
            const employeeRef = ref(database, `Nursing_Records/${editingEmployee.id}`);
            await update(employeeRef, editingEmployee);
            
            // Update local state instead of fetching all employees
            setEmployees(prevEmployees =>
                prevEmployees.map(emp =>
                    emp.id === editingEmployee.id ? editingEmployee : emp
                )
            );
            
            setShowModal(false);
            setEditingEmployee(null);
        } catch (err) {
            setError(`Failed to update employee.`);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (employee) => {
        setEditingEmployee(employee);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingEmployee(null);
    };

    const handleSync = async () => {
        setSyncing(true);
        setError(null);
        console.log('[Debug] Starting sync process...');
        try {
            // 1. Fetch faction members from Realtime Database
            const factionMembersRef = ref(database, 'factions/364/members');
            const factionSnapshot = await get(factionMembersRef);
            if (!factionSnapshot.exists()) {
                throw new Error("Faction members data not found in Realtime Database.");
            }
            const allFactionMembers = factionSnapshot.val();
            console.log('[Debug] Fetched all faction members:', allFactionMembers);


            // 2. Filter for nursing staff
            const nursingStaff = Object.values(allFactionMembers).filter(member =>
                member.rank.includes('Nurse') || member.rank.includes('Nursing')
            );
            console.log('[Debug] Filtered nursing staff:', nursingStaff);
            const nursingStaffIds = new Set(nursingStaff.map(member => member.characterId));

            // 3. Fetch current employees from Realtime Database
            const rtdbEmployeesRef = ref(database, 'Nursing_Records');
            const rtdbEmployeesSnapshot = await get(rtdbEmployeesRef);
            const rtdbEmployees = rtdbEmployeesSnapshot.exists() ? rtdbEmployeesSnapshot.val() : {};
            console.log('[Debug] Fetched existing RTDB employees:', rtdbEmployees);

            const rtdbEmployeesByCharId = Object.fromEntries(
                Object.entries(rtdbEmployees).map(([id, emp]) => [emp.characterId, { ...emp, id }])
            );
            console.log('[Debug] Mapped RTDB employees by char ID:', rtdbEmployeesByCharId);


            // 4. Add or update employees
            console.log('[Debug] Checking for new or updated employees...');
            for (const member of nursingStaff) {
                const [name, surname] = member.characterName.split(' ');
                const existingEmployee = rtdbEmployeesByCharId[member.characterId];

                if (existingEmployee) {
                    // Update existing employee's rank if it has changed
                    if(existingEmployee.factionRank !== member.rank) {
                        console.log(`[Debug] Updating rank for ${member.characterName} from ${existingEmployee.factionRank} to ${member.rank}`);
                        const employeeRef = ref(database, `Nursing_Records/${existingEmployee.id}`);
                        await update(employeeRef, { factionRank: member.rank });
                    }
                } else {
                    // Add new employee, using characterId as the key to prevent duplicates
                    console.log(`[Debug] Adding new employee: ${member.characterName}`);
                    const newEmployeeRef = ref(database, `Nursing_Records/char_${member.characterId}`);
                    await set(newEmployeeRef, {
                        characterId: member.characterId,
                        name: name || '',
                        surname: surname || '',
                        factionRank: member.rank,
                        family: '',
                        closeFamily: '',
                        address: '',
                        phoneNumber: '',
                        createdAt: new Date().toISOString()
                    });
                }
            }

            // 5. Remove old employees
            console.log('[Debug] Checking for employees to remove...');
            for (const empId in rtdbEmployees) {
                const employee = rtdbEmployees[empId];
                if (employee.characterId && !nursingStaffIds.has(employee.characterId)) {
                    console.log(`[Debug] Removing employee: ${employee.name} ${employee.surname} (ID: ${employee.characterId})`);
                    const employeeRef = ref(database, `Nursing_Records/${empId}`);
                    await remove(employeeRef);
                }
            }
            
            console.log('[Debug] Sync process complete. Refreshing employee list.');
            // Refresh the list
            fetchEmployees();

        } catch (err) {
            setError('Failed to synchronize faction staff.');
            console.error(err);
        } finally {
            setSyncing(false);
        }
    };


    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h3>Employee Records</h3>
                <Button variant="success" onClick={handleSync} disabled={syncing} className="d-flex align-items-center">
                    {syncing ? (
                        <>
                            <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                            Syncing...
                        </>
                    ) : (
                        <>
                            <i className="fas fa-sync-alt me-2"></i> Load Employees
                        </>
                    )}
                </Button>
            </div>

            {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

            {loading && !employees.length ? (
                <div className="text-center">
                    <Spinner animation="border" />
                </div>
            ) : (
                <Table striped bordered hover responsive>
                    <thead>
                        <tr>
                            <th><i className="fas fa-user me-2"></i>Name</th>
                            <th><i className="fas fa-user me-2"></i>Surname</th>
                            <th><i className="fas fa-briefcase me-2"></i>Rank</th>
                            <th><i className="fas fa-users me-2"></i>Family</th>
                            <th><i className="fas fa-user-friends me-2"></i>Close Family</th>
                            <th><i className="fas fa-map-marker-alt me-2"></i>Address</th>
                            <th><i className="fas fa-phone me-2"></i>Phone Number</th>
                            <th><i className="fas fa-cogs me-2"></i>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {employees.map(employee => (
                            <tr key={employee.id}>
                                <td>{employee.name}</td>
                                <td>{employee.surname}</td>
                                <td>{employee.factionRank}</td>
                                <td>{employee.family}</td>
                                <td>{employee.closeFamily}</td>
                                <td>{employee.address}</td>
                                <td>{employee.phoneNumber}</td>
                                <td>
                                    <Button variant="outline-primary" size="sm" onClick={() => handleEdit(employee)}>
                                        <i className="fas fa-edit"></i>
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}

            {showModal && ReactDOM.createPortal(
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="cctv-modal-dialog" onClick={e => e.stopPropagation()}>
                        <div className="cctv-modal-header">
                            <h4 className="cctv-title">Edit Employee Record</h4>
                            <button
                                type="button"
                                className="modal-close-btn"
                                onClick={handleCloseModal}
                                aria-label="Close"
                            >
                                &times;
                            </button>
                        </div>
                        <div className="cctv-modal-body">
                            {editingEmployee && (
                                <>
                                    <div className="cctv-form-section">
                                        <h5><i className="fas fa-user me-2"></i>Personal Information</h5>
                                        <div className="cctv-form-row">
                                            <div className="cctv-form-group">
                                                <label className="cctv-form-label required">Name</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    name="name"
                                                    value={editingEmployee.name}
                                                    onChange={handleInputChange}
                                                    placeholder="Enter first name"
                                                    disabled={true}
                                                    title="Name cannot be modified"
                                                />
                                            </div>
                                            <div className="cctv-form-group">
                                                <label className="cctv-form-label required">Surname</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    name="surname"
                                                    value={editingEmployee.surname}
                                                    onChange={handleInputChange}
                                                    placeholder="Enter last name"
                                                    disabled={true}
                                                    title="Surname cannot be modified"
                                                />
                                            </div>
                                        </div>

                                        <div className="cctv-form-row">
                                            <div className="cctv-form-group">
                                                <label className="cctv-form-label">Family</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    name="family"
                                                    value={editingEmployee.family}
                                                    onChange={handleInputChange}
                                                    placeholder="Extended family connections"
                                                    disabled={loading}
                                                />
                                            </div>
                                            <div className="cctv-form-group">
                                                <label className="cctv-form-label">Close Family</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    name="closeFamily"
                                                    value={editingEmployee.closeFamily}
                                                    onChange={handleInputChange}
                                                    placeholder="Immediate family members"
                                                    disabled={loading}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="cctv-form-section">
                                        <h5><i className="fas fa-address-card me-2"></i>Contact & Location Information</h5>
                                        <div className="cctv-form-row">
                                            <div className="cctv-form-group full-width">
                                                <label className="cctv-form-label">Address</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    name="address"
                                                    value={editingEmployee.address}
                                                    onChange={handleInputChange}
                                                    placeholder="Residential address"
                                                    disabled={loading}
                                                />
                                            </div>
                                        </div>

                                        <div className="cctv-form-row">
                                            <div className="cctv-form-group">
                                                <label className="cctv-form-label">Phone Number</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    name="phoneNumber"
                                                    value={editingEmployee.phoneNumber}
                                                    onChange={handleInputChange}
                                                    placeholder="Contact phone number"
                                                    disabled={loading}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="cctv-modal-footer">
                            <button className="cctv-btn cctv-btn-secondary" onClick={handleCloseModal} disabled={loading}>
                                Cancel
                            </button>
                            <button
                                className="cctv-btn cctv-btn-primary"
                                onClick={handleUpdateEmployee}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <div className="cctv-spinner"></div>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-save"></i>
                                        Save Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>,
                document.getElementById('modal-root')
            )}
        </div>
    );
};


export default EmployeeManager;
