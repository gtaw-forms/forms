import React, { useState, useEffect } from 'react';
import { database } from '../../firebase';
import { ref, get } from 'firebase/database';
import { Spinner, Table, Form, InputGroup } from 'react-bootstrap';

const MetricsDashboard = () => {
    const [metricsData, setMetricsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('users'); // 'users' or 'protocols'

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const metricsRef = ref(database, 'user_metrics');
                const snapshot = await get(metricsRef);
                if (snapshot.exists()) {
                    setMetricsData(snapshot.val());
                } else {
                    setMetricsData({});
                }
            } catch (err) {
                console.error("Error fetching metrics:", err);
                setError("Failed to load metrics data.");
            } finally {
                setLoading(false);
            }
        };

        fetchMetrics();
    }, []);

    if (loading) return <div className="text-center p-5"><Spinner animation="border" /></div>;
    if (error) return <div className="alert alert-danger">{error}</div>;
    if (!metricsData) return <div className="text-center p-5">No metrics data available.</div>;

    // --- Data Processing ---

    // 1. User Aggregate Data
    const processUserMetrics = () => {
        const userStats = [];
        Object.entries(metricsData).forEach(([ucpName, categories]) => {
            let totalVisits = 0;
            let lastActive = 0;
            let actions = 0;

            Object.entries(categories).forEach(([category, subCategories]) => {
                Object.values(subCategories).forEach(metric => {
                    totalVisits += metric.visit_count || 0;
                    if (metric.last_visited > lastActive) lastActive = metric.last_visited;
                    actions++;
                });
            });

            if (ucpName.toLowerCase().includes(searchTerm.toLowerCase())) {
                userStats.push({
                    ucpName: ucpName.replace(/_/g, ' '), // Restore spaces for display if needed
                    totalVisits,
                    lastActive,
                    actionsCount: actions
                });
            }
        });

        return userStats.sort((a, b) => b.lastActive - a.lastActive);
    };

    // 2. Protocol/Page Popularity Data
    const processPageMetrics = () => {
        const pageStats = {};

        Object.values(metricsData).forEach(categories => {
            Object.entries(categories).forEach(([category, subCategories]) => {
                Object.entries(subCategories).forEach(([subCategory, metric]) => {
                    const key = `${category} - ${subCategory}`;
                    if (!pageStats[key]) {
                        pageStats[key] = {
                            name: key,
                            category: category,
                            subCategory: subCategory,
                            totalViews: 0,
                            uniqueUsers: new Set(),
                            lastAccessed: 0
                        };
                    }
                    pageStats[key].totalViews += metric.visit_count || 0;
                    // We don't have user ID here easily without parent loop, 
                    // but we know we are inside a specific user's object loop in the outer scope?
                    // actually yes, the outer loop (Object.values(metricsData)) iterates users.
                    // But I lost the key in Object.values. Let's refactor slightly if we want unique users.
                });
            });
        });
        
        // Refactored to capture unique users count
        const refinedPageStats = {};
        Object.entries(metricsData).forEach(([ucpName, categories]) => {
             Object.entries(categories).forEach(([category, subCategories]) => {
                Object.entries(subCategories).forEach(([subCategory, metric]) => {
                    const key = `${category} / ${subCategory}`;
                    if (!refinedPageStats[key]) {
                        refinedPageStats[key] = {
                            id: key,
                            category: category,
                            action: subCategory,
                            totalViews: 0,
                            uniqueUsers: new Set(),
                            lastAccessed: 0
                        };
                    }
                    refinedPageStats[key].totalViews += metric.visit_count || 0;
                    refinedPageStats[key].uniqueUsers.add(ucpName);
                    if (metric.last_visited > refinedPageStats[key].lastAccessed) {
                        refinedPageStats[key].lastAccessed = metric.last_visited;
                    }
                });
            });
        });

        const statsArray = Object.values(refinedPageStats).map(stat => ({
            ...stat,
            uniqueUserCount: stat.uniqueUsers.size
        }));

        return statsArray
            .filter(item => item.id.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => b.totalViews - a.totalViews);
    };

    const userRows = viewMode === 'users' ? processUserMetrics() : [];
    const pageRows = viewMode === 'protocols' ? processPageMetrics() : [];

    return (
        <div className="metrics-dashboard">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h4 className="mb-0">Application Usage Metrics</h4>
                <div className="btn-group">
                    <button 
                        className={`btn ${viewMode === 'users' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setViewMode('users')}
                    >
                        <i className="fas fa-users me-2"></i> User Activity
                    </button>
                    <button 
                        className={`btn ${viewMode === 'protocols' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setViewMode('protocols')}
                    >
                        <i className="fas fa-chart-bar me-2"></i> Page/Action Popularity
                    </button>
                </div>
            </div>

            <div className="card mb-4">
                <div className="card-body">
                    <InputGroup className="mb-3">
                        <InputGroup.Text><i className="fas fa-search"></i></InputGroup.Text>
                        <Form.Control
                            placeholder={viewMode === 'users' ? "Search users..." : "Search actions..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </InputGroup>

                    <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        <Table striped hover size="sm">
                            <thead className="table-dark" style={{ position: 'sticky', top: 0 }}>
                                {viewMode === 'users' ? (
                                    <tr>
                                        <th>UCP Name</th>
                                        <th className="text-center">Total Actions</th>
                                        <th className="text-center">Distinct Actions</th>
                                        <th className="text-end">Last Active</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        <th>Category / Action</th>
                                        <th className="text-center">Total Hits</th>
                                        <th className="text-center">Unique Users</th>
                                        <th className="text-end">Last Accessed</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody>
                                {viewMode === 'users' ? (
                                    userRows.length > 0 ? (
                                        userRows.map((user, idx) => (
                                            <tr key={idx}>
                                                <td>{user.ucpName}</td>
                                                <td className="text-center">{user.totalVisits}</td>
                                                <td className="text-center">{user.actionsCount}</td>
                                                <td className="text-end">
                                                    {user.lastActive ? new Date(user.lastActive).toLocaleString() : 'N/A'}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan="4" className="text-center">No matching users found</td></tr>
                                    )
                                ) : (
                                    pageRows.length > 0 ? (
                                        pageRows.map((page, idx) => (
                                            <tr key={idx}>
                                                <td>
                                                    <span className="badge bg-secondary me-2">{page.category}</span>
                                                    {page.action.replace(/^protocol_view_/, 'Protocol: ')}
                                                </td>
                                                <td className="text-center">{page.totalViews}</td>
                                                <td className="text-center">{page.uniqueUserCount}</td>
                                                <td className="text-end">
                                                    {page.lastAccessed ? new Date(page.lastAccessed).toLocaleString() : 'N/A'}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan="4" className="text-center">No matching actions found</td></tr>
                                    )
                                )}
                            </tbody>
                        </Table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MetricsDashboard;
