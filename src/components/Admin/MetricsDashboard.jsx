import React, { useState, useEffect } from 'react';
import { database } from '../../firebase';
import { ref, get } from 'firebase/database';
import { Spinner, Table, Form, InputGroup, Button } from 'react-bootstrap';

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

    // Calculate quick stats
    const totalActions = userRows.reduce((acc, row) => acc + row.totalVisits, 0);
    const activeUsers = userRows.length;
    const topAction = pageRows[0]?.id || 'N/A';

    return (
        <div className="admin-section">
            <div className="d-flex justify-content-between align-items-center mb-5">
                <h2 className="mb-0 fw-800"><i className="fas fa-chart-line me-3 text-indigo"></i>Usage Metrics</h2>
                <div className="btn-group">
                    <Button 
                        variant={viewMode === 'users' ? 'primary' : 'outline-secondary'}
                        onClick={() => setViewMode('users')}
                        className="px-4"
                    >
                        <i className="fas fa-users me-2"></i> User Activity
                    </Button>
                    <Button 
                        variant={viewMode === 'protocols' ? 'primary' : 'outline-secondary'}
                        onClick={() => setViewMode('protocols')}
                        className="px-4"
                    >
                        <i className="fas fa-chart-bar me-2"></i> Action Popularity
                    </Button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="admin-stat-row">
                <div className="admin-stat-card">
                    <span className="stat-label">Total Interactions</span>
                    <span className="stat-value">{totalActions.toLocaleString()}</span>
                </div>
                <div className="admin-stat-card">
                    <span className="stat-label">Active Users</span>
                    <span className="stat-value">{activeUsers}</span>
                </div>
                <div className="admin-stat-card">
                    <span className="stat-label">Most Used Tool</span>
                    <span className="stat-value text-truncate" title={topAction} style={{ fontSize: '1.2rem' }}>
                        {topAction.split('/').pop()?.replace('protocol_view_', '') || 'N/A'}
                    </span>
                </div>
            </div>

            <div className="card border-0 shadow-sm">
                <div className="card-body p-4">
                    <InputGroup className="mb-4">
                        <InputGroup.Text className="bg-dark border-secondary text-muted"><i className="fas fa-search"></i></InputGroup.Text>
                        <Form.Control
                            className="bg-dark border-secondary text-white"
                            placeholder={viewMode === 'users' ? "Search users by UCP..." : "Search protocols/actions..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </InputGroup>

                    <div className="admin-modern-table">
                        <Table hover responsive>
                            <thead>
                                {viewMode === 'users' ? (
                                    <tr>
                                        <th>UCP Identity</th>
                                        <th className="text-center">Interactions</th>
                                        <th className="text-center">Tools Used</th>
                                        <th className="text-end">Last Session</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        <th>Target Area</th>
                                        <th className="text-center">Total Hits</th>
                                        <th className="text-center">Unique Reach</th>
                                        <th className="text-end">Last Hit</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody>
                                {viewMode === 'users' ? (
                                    userRows.length > 0 ? (
                                        userRows.map((user, idx) => (
                                            <tr key={idx}>
                                                <td className="fw-bold text-indigo">{user.ucpName}</td>
                                                <td className="text-center"><span className="badge bg-indigo bg-opacity-10 text-indigo px-3">{user.totalVisits}</span></td>
                                                <td className="text-center">{user.actionsCount}</td>
                                                <td className="text-end text-muted small">
                                                    {user.lastActive ? new Date(user.lastActive).toLocaleString() : 'N/A'}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan="4" className="text-center py-5 text-muted">No matching users found</td></tr>
                                    )
                                ) : (
                                    pageRows.length > 0 ? (
                                        pageRows.map((page, idx) => (
                                            <tr key={idx}>
                                                <td>
                                                    <span className="admin-badge admin-badge-indigo me-2">{page.category}</span>
                                                    <span className="fw-500">{page.action.replace(/^protocol_view_/, '')}</span>
                                                </td>
                                                <td className="text-center fw-bold">{page.totalViews}</td>
                                                <td className="text-center">
                                                    <span className="badge bg-secondary bg-opacity-25 px-2">{page.uniqueUserCount} Users</span>
                                                </td>
                                                <td className="text-end text-muted small">
                                                    {page.lastAccessed ? new Date(page.lastAccessed).toLocaleString() : 'N/A'}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan="4" className="text-center py-5 text-muted">No matching actions found</td></tr>
                                    )
                                )}
                            </tbody>
                        </Table>
                    </div>
                </div>
            </div>
            <style>{`
                .fw-800 { font-weight: 800; }
                .fw-500 { font-weight: 500; }
                .text-indigo { color: var(--admin-accent) !important; }
            `}</style>
        </div>
    );
};

export default MetricsDashboard;
