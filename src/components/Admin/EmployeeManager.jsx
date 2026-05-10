import React, { useState, useCallback, useMemo, Fragment } from 'react';
import { database } from '../../firebase';
import { ref, get } from 'firebase/database';
import { useData } from '../../contexts/DataContext';
import { Table, Button, Spinner, Alert, Card, Row, Col, Form, Tabs, Tab, InputGroup  } from 'react-bootstrap';
import './AdminDashboard.css'; // Reusing some styles

const EmployeeManager = () => {
    const { formsData } = useData();
    const [stats, setStats] = useState(null);
    const [categoryStats, setCategoryStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('total');
    const [sortOrder, setSortOrder] = useState('desc');
    const [activeTab, setActiveTab] = useState('overview');
    const [expandedRow, setExpandedRow] = useState(null);

    const getCategoryBadgeClass = (category) => {
        if (category === 'DMEC') return 'admin-badge-danger';
        if (category === 'PHMC Staff') return 'admin-badge-indigo';
        if (category === 'OBGYN') return 'admin-badge-warning';
        if (category === 'Mental Health') return 'admin-badge-success';
        return '';
    };

    const formMetaMap = useMemo(() => {
        if (!formsData) return {};
        return formsData.reduce((acc, form) => {
            acc[form.firebaseKey] = {
                category: form.category || 'Uncategorized',
                name: form.name || 'Unknown Form'
            };
            return acc;
        }, {});
    }, [formsData]);

    const fetchAndProcessData = useCallback(async () => {
        setLoading(true);
        setError(null);
        setStats(null);
        setCategoryStats(null);
        setExpandedRow(null);

        try {
            // 1. Fetch all data concurrently
            const reportsRef = ref(database, 'newSavedReports');
            const factionMembersRef = ref(database, 'factions/364/members');

            const [reportsSnapshot, factionMembersSnapshot] = await Promise.all([
                get(reportsRef),
                get(factionMembersRef)
            ]);

            // 2. Process Faction Members to get current ranks
            const memberRankMap = {};
            if (factionMembersSnapshot.exists()) {
                const memberData = factionMembersSnapshot.val();
                Object.values(memberData).forEach(member => {
                    if (member.characterName && member.rank) {
                        memberRankMap[member.characterName] = member.rank;
                    }
                });
            }

            // 3. Process Reports
            if (!reportsSnapshot.exists()) {
                throw new Error("No reports found in 'newSavedReports'.");
            }
            const reportsByAuthor = reportsSnapshot.val();
            const employeeProcessingStore = {};
            const categoryProcessingStore = {};
            
            const nameMergeMap = {
              'Roger Rose': 'Roger McFarlane*',
              'Brock Renfroe': 'Roger McFarlane*',
              'Roger McFarlane': 'Roger McFarlane*',
              'Lierin Sherwood': 'Roger McFarlane*',
            };

            for (const authorId in reportsByAuthor) {
                const reports = reportsByAuthor[authorId];
                
                for (const reportKey in reports) {
                    const report = reports[reportKey];
                    let authorName = report.authorName || authorId;

                    // Merge specified names
                    authorName = nameMergeMap[authorName] || authorName;

                    if (!employeeProcessingStore[authorName]) {
                        // Use the rank of the primary name if available
                        const rankLookupName = authorName === 'Roger McFarlane*' ? 'Roger McFarlane' : authorName;
                        employeeProcessingStore[authorName] = {
                            name: authorName,
                            rank: memberRankMap[rankLookupName] || 'N/A',
                            total: 0,
                            categories: {}
                        };
                    }
                    
                    const formMeta = formMetaMap[report.formId] || { category: 'Uncategorized', name: report.formName || 'Unknown Form' };
                    const { category, name: formName } = formMeta;

                    // Increment employee stats
                    employeeProcessingStore[authorName].total += 1;
                    employeeProcessingStore[authorName].categories[category] = (employeeProcessingStore[authorName].categories[category] || 0) + 1;
                
                    // Initialize category structure if it doesn't exist
                    if (!categoryProcessingStore[category]) {
                        categoryProcessingStore[category] = { total: 0, forms: {} };
                    }
                    if (!categoryProcessingStore[category].forms[formName]) {
                        categoryProcessingStore[category].forms[formName] = { total: 0, employees: {} };
                    }

                    // Increment category totals and employee-specific counts
                    categoryProcessingStore[category].total += 1;
                    categoryProcessingStore[category].forms[formName].total += 1;
                    categoryProcessingStore[category].forms[formName].employees[authorName] = (categoryProcessingStore[category].forms[formName].employees[authorName] || 0) + 1;
                }
            }
            
            setStats(Object.values(employeeProcessingStore));
            setCategoryStats(categoryProcessingStore);

        } catch (err)
            {
            setError(`Failed to fetch or process data: ${err.message}`);
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [formMetaMap]);
    
    const summaryStats = useMemo(() => {
        if (!stats) return {};
        const summary = {
            totalReports: 0,
            'DMEC': 0,
            'PHMC Staff': 0,
            'OBGYN': 0,
            'Mental Health': 0,
            'Uncategorized': 0,
        };
        stats.forEach(employee => {
            summary.totalReports += employee.total;
            for (const category in employee.categories) {
                if (summary.hasOwnProperty(category)) {
                    summary[category] += employee.categories[category];
                } else {
                    summary['Uncategorized'] += employee.categories[category];
                }
            }
        });
        return summary;
    }, [stats]);

    const filteredAndSortedStats = useMemo(() => {
        if (!stats) return [];
        return stats
            .filter(emp => emp.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => {
                let valA = a[sortBy];
                let valB = b[sortBy];

                if (sortBy.startsWith('category-')) {
                    const cat = sortBy.split('-')[1];
                    valA = a.categories[cat] || 0;
                    valB = b.categories[cat] || 0;
                }

                if (sortOrder === 'asc') {
                    return typeof valA === 'string' ? valA.localeCompare(valB) : valA - valB;
                } else {
                    return typeof valA === 'string' ? valB.localeCompare(valA) : valB - valA;
                }
            });
    }, [stats, searchTerm, sortBy, sortOrder]);

    const handleSort = (column) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('desc');
        }
    };

    const getSortIcon = (column) => {
        if (sortBy === column) {
            return sortOrder === 'asc' ? <i className="fas fa-sort-up ms-2"></i> : <i className="fas fa-sort-down ms-2"></i>;
        }
        return <i className="fas fa-sort ms-2 text-muted"></i>;
    };
    
    const handleRowToggle = (rowKey) => {
        setExpandedRow(expandedRow === rowKey ? null : rowKey);
    };

    return (
        <div className="admin-section">
            <div className="d-flex justify-content-between align-items-center mb-5">
                <h2 className="mb-0 fw-800"><i className="fas fa-users-cog me-3 text-indigo"></i>Performance Analytics</h2>
                <Button variant="primary" onClick={fetchAndProcessData} disabled={loading} className="admin-btn shadow-sm">
                    {loading ? (
                        <>
                            <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <i className="fas fa-sync-alt me-2"></i> Sync Report Data
                        </>
                    )}
                </Button>
            </div>

            {error && <Alert variant="danger" className="border-0 shadow-sm">{error}</Alert>}

            {loading && (
                 <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-3 text-muted">Analyzing historical report data...</p>
                </div>
            )}

            {stats && (
                <>
                    <div className="admin-stat-row">
                        {Object.entries(summaryStats).map(([key, value]) => (
                             <div className="admin-stat-card" key={key}>
                                <span className="stat-label text-truncate" title={key}>{key}</span>
                                <span className="stat-value">{value.toLocaleString()}</span>
                             </div>
                        ))}
                    </div>
                
                    <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} id="analytics-tabs" className="mb-4" variant="pills">
                        <Tab eventKey="overview" title="Full Staff Overview">
                            <div className="card border-0 shadow-sm mb-4">
                                <div className="card-body p-4">
                                    <Form.Group className="mb-4">
                                        <InputGroup>
                                            <InputGroup.Text className="bg-dark border-secondary text-muted"><i className="fas fa-search"></i></InputGroup.Text>
                                            <Form.Control 
                                                className="bg-dark border-secondary text-white"
                                                type="text"
                                                placeholder="Search by character name..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </InputGroup>
                                    </Form.Group>

                                    <div className="admin-modern-table">
                                        <Table hover responsive>
                                            <thead>
                                                <tr>
                                                    <th onClick={() => handleSort('name')} className="cursor-pointer">Name {getSortIcon('name')}</th>
                                                    <th onClick={() => handleSort('rank')} className="cursor-pointer">Current Rank {getSortIcon('rank')}</th>
                                                    <th onClick={() => handleSort('total')} className="text-center cursor-pointer">Total {getSortIcon('total')}</th>
                                                    <th onClick={() => handleSort('category-DMEC')} className="text-center cursor-pointer">DMEC</th>
                                                    <th onClick={() => handleSort('category-PHMC Staff')} className="text-center cursor-pointer">PHMC</th>
                                                    <th onClick={() => handleSort('category-OBGYN')} className="text-center cursor-pointer">OBGYN</th>
                                                    <th onClick={() => handleSort('category-Mental Health')} className="text-center cursor-pointer">Mental</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredAndSortedStats.map(employee => (
                                                    <tr key={employee.name}>
                                                        <td className="fw-bold text-indigo">{employee.name}</td>
                                                        <td><small className="text-muted">{employee.rank}</small></td>
                                                        <td className="text-center fw-bold">{employee.total}</td>
                                                        <td className="text-center"><span className="admin-badge admin-badge-danger">{employee.categories['DMEC'] || 0}</span></td>
                                                        <td className="text-center"><span className="admin-badge admin-badge-indigo">{employee.categories['PHMC Staff'] || 0}</span></td>
                                                        <td className="text-center"><span className="admin-badge admin-badge-warning">{employee.categories['OBGYN'] || 0}</span></td>
                                                        <td className="text-center"><span className="admin-badge admin-badge-success">{employee.categories['Mental Health'] || 0}</span></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        </Tab>
                        {categoryStats && Object.entries(categoryStats).sort(([a], [b]) => a.localeCompare(b)).map(([category, data]) => (
                            <Tab eventKey={category} title={`${category} (${data.total})`} key={category}>
                                <div className="card border-0 shadow-sm mb-4">
                                    <div className="card-body p-4">
                                        <div className="admin-modern-table mb-0">
                                            <Table hover responsive>
                                                <thead>
                                                    <tr>
                                                        <th>Form Name</th>
                                                        <th className="text-center">Usage Count</th>
                                                        <th className="text-center">Contribution</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {Object.entries(data.forms).sort(([, a], [, b]) => b.total - a.total).map(([formName, formData]) => {
                                                        const rowKey = `${category}-${formName}`;
                                                        const isExpanded = expandedRow === rowKey;
                                                        return(
                                                        <Fragment key={rowKey}>
                                                            <tr onClick={() => handleRowToggle(rowKey)} className="cursor-pointer">
                                                                <td className="fw-bold"><i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'} me-3 text-indigo`}></i>{formName}</td>
                                                                <td className="text-center fw-bold">{formData.total}</td>
                                                                <td className="text-center">
                                                                    <div className="progress bg-dark" style={{ height: '8px', borderRadius: '4px' }}>
                                                                        <div 
                                                                            className="progress-bar bg-indigo" 
                                                                            style={{ width: `${((formData.total / data.total) * 100)}%` }}
                                                                        ></div>
                                                                    </div>
                                                                    <small className="text-muted mt-1 d-block">{((formData.total / data.total) * 100).toFixed(1)}%</small>
                                                                </td>
                                                            </tr>
                                                            {isExpanded && (
                                                                <tr className="bg-black bg-opacity-25">
                                                                    <td colSpan="3">
                                                                        <div className="p-4 mx-4 my-2 rounded bg-dark border border-secondary border-opacity-25">
                                                                            <h6 className="text-indigo mb-3 small uppercase fw-bold">Individual Usage Breakdown</h6>
                                                                            <Table size="sm" className="table-dark table-borderless bg-transparent mb-0">
                                                                                <thead>
                                                                                    <tr className="border-bottom border-secondary border-opacity-25">
                                                                                        <th className="pb-2">Employee Identity</th>
                                                                                        <th className="text-end pb-2">Submissions</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {Object.entries(formData.employees).sort(([, a], [, b]) => b - a).map(([empName, count]) => (
                                                                                        <tr key={empName}>
                                                                                            <td className="py-2">{empName}</td>
                                                                                            <td className="text-end py-2 fw-bold text-success">{count}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </Table>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </Fragment>
                                                    )})}
                                                </tbody>
                                            </Table>
                                        </div>
                                    </div>
                                </div>
                            </Tab>
                        ))}
                    </Tabs>
                </>
            )}
            <style>{`
                .cursor-pointer { cursor: pointer; }
                .bg-indigo { background-color: var(--admin-accent) !important; }
                .fw-800 { font-weight: 800; }
                .uppercase { text-transform: uppercase; }
            `}</style>
        </div>
    );
};

export default EmployeeManager;
