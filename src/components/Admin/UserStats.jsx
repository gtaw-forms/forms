import React, { useState, useEffect } from 'react';
import { getDatabase, ref, get } from 'firebase/database';

const comprehensiveSanitize = (str) => {
    if (!str) return '';
    let sanitized = str.trim().replace(/[.#$[/ \]]+/g, '_');
    sanitized = sanitized.replace(/_{2,}/g, '_');
    sanitized = sanitized.replace(/^_+|_+$/g, '');
    return sanitized;
};

const UserStats = ({ currentUser }) => {
    const [employees, setEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [reportCount, setReportCount] = useState(0);
    const [topFive, setTopFive] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchEmployees = async () => {
            setLoading(true);
            const db = getDatabase();
            const savedReportsRef = ref(db, 'savedReports');
            const snapshot = await get(savedReportsRef);
            if (snapshot.exists()) {
                const users = Object.keys(snapshot.val());
                const employeeList = users.map(user => ({ uid: user, character_name: user.replace(/_/g, ' ') }));
                setEmployees(employeeList);
            }
            setLoading(false);
        };
        fetchEmployees();
    }, []);

    const handleSearch = async () => {
        if (!selectedEmployee) {
            console.log("[handleSearch] No employee selected.");
            return;
        }
        setLoading(true);
        console.log(`[handleSearch] Starting search for: "${selectedEmployee}"`);

        const sanitizedEmployee = comprehensiveSanitize(selectedEmployee);
        console.log(`[handleSearch] Sanitized name: "${sanitizedEmployee}"`);

        const db = getDatabase();
        const reportsRef = ref(db, `savedReports/${sanitizedEmployee}`);
        console.log(`[handleSearch] Querying Firebase path: ${reportsRef.toString()}`);

        try {
            const snapshot = await get(reportsRef);
            console.log("[handleSearch] Firebase snapshot received:", snapshot);

            if (snapshot.exists()) {
                const reports = snapshot.val();
                console.log("[handleSearch] Reports data:", reports);
                const count = Object.keys(reports).length;
                console.log(`[handleSearch] Found ${count} reports.`);
                setReportCount(count);
            } else {
                console.log("[handleSearch] No data exists at this path.");
                setReportCount(0);
            }
        } catch (error) {
            console.error("[handleSearch] Error fetching reports:", error);
            setReportCount(0);
        }

        setLoading(false);
    };

    useEffect(() => {
        const calculateTopFive = async () => {
            setLoading(true);
            const db = getDatabase();
            const reportsRef = ref(db, 'savedReports');
            const snapshot = await get(reportsRef);
            if (snapshot.exists()) {
                const reportsData = snapshot.val();
                const userReportCounts = Object.keys(reportsData).map(authorId => ({
                    name: authorId.replace(/_/g, ' '),
                    count: Object.keys(reportsData[authorId]).length
                }));

                const sortedUsers = userReportCounts.sort((a, b) => b.count - a.count);
                const topUsers = sortedUsers.slice(0, 10);
                setTopFive(topUsers);
            }
            setLoading(false);
        };
        calculateTopFive();
    }, []);

    return (
        <div>
            <div className="card">
                <div className="card-header">User Stats</div>
                <div className="card-body">
                    <div className="form-group mt-3">
                        <label>Select Employee</label>
                        <select className="form-control" value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}>
                            <option value="">Select an employee</option>
                            {employees.map(emp => (
                                <option key={emp.uid} value={emp.character_name}>{emp.character_name}</option>
                            ))}
                        </select>
                    </div>
                    <button className="btn btn-primary mt-3" onClick={handleSearch} disabled={loading}>
                        {loading ? 'Searching...' : 'Search Reports'}
                    </button>
                    {reportCount > 0 && <p className="mt-3">Total Reports: {reportCount}</p>}
                </div>
            </div>
            <div className="card mt-4">
                <div className="card-header">Top 5 Users by Reports</div>
                <div className="card-body">
                    {loading ? <p>Loading...</p> : (
                        <ul className="list-group">
                            {topFive.map(user => (
                                <li key={user.name} className="list-group-item d-flex justify-content-between align-items-center">
                                    {user.name}
                                    <span className="badge bg-primary rounded-pill">{user.count}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserStats;
