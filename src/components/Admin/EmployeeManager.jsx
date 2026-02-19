import React, { useState, useCallback, useMemo, Fragment } from 'react';
import { database } from '../../firebase';
import { ref, get } from 'firebase/database';
import { useData } from '../../contexts/DataContext';
import { Table, Button, Spinner, Alert, Card, Row, Col, Form, Tabs, Tab } from 'react-bootstrap';
import './AdminDashboard.css'; // Reusing some styles

const CATEGORY_STYLES = {
    'DMEC': { backgroundColor: '#dc3545', color: 'white' },
    'PHMC Staff': { backgroundColor: '#0d6efd', color: 'white' },
    'OBGYN': { backgroundColor: '#ffc107', color: 'black' },
    'Mental Health': { backgroundColor: '#0dcaf0', color: 'black' },
    'Default': { backgroundColor: '#6c757d', color: 'white' }
};

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
        <div>
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h3>Employee Report Analytics</h3>
                <Button variant="success" onClick={fetchAndProcessData} disabled={loading} className="d-flex align-items-center">
                    {loading ? (
                        <>
                            <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                            Loading Data...
                        </>
                    ) : (
                        <>
                            <i className="fas fa-sync-alt me-2"></i> Load Report Data
                        </>
                    )}
                </Button>
            </div>

            {error && <Alert variant="danger">{error}</Alert>}

            {loading && (
                 <div className="text-center">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-2">Fetching and processing thousands of reports... this may take a moment.</p>
                </div>
            )}

            {stats && (
                <>
                    <Row className="mb-4">
                        {Object.entries(summaryStats).map(([key, value]) => (
                             <Col md={2} key={key}>
                                <Card body className="text-center" style={CATEGORY_STYLES[key] || CATEGORY_STYLES['Default']}>
                                    <h4 className="mb-0">{value}</h4>
                                    <p className="mb-0 small">{key}</p>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                
                    <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} id="analytics-tabs" className="mb-3" variant="pills">
                        <Tab eventKey="overview" title="Employee Overview">
                            <Form.Group className="mb-3">
                                <Form.Control 
                                    type="text"
                                    placeholder="Search by employee name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </Form.Group>

                            <Table striped bordered hover responsive>
                                <thead>
                                    <tr>
                                        <th onClick={() => handleSort('name')}>Name {getSortIcon('name')}</th>
                                        <th onClick={() => handleSort('rank')}>Rank {getSortIcon('rank')}</th>
                                        <th onClick={() => handleSort('total')}>Total Reports {getSortIcon('total')}</th>
                                        <th onClick={() => handleSort('category-DMEC')}>DMEC {getSortIcon('category-DMEC')}</th>
                                        <th onClick={() => handleSort('category-PHMC Staff')}>PHMC Staff {getSortIcon('category-PHMC Staff')}</th>
                                        <th onClick={() => handleSort('category-OBGYN')}>OBGYN {getSortIcon('category-OBGYN')}</th>
                                        <th onClick={() => handleSort('category-Mental Health')}>Mental Health {getSortIcon('category-Mental Health')}</th>
                                        <th onClick={() => handleSort('category-Uncategorized')}>Uncategorized {getSortIcon('category-Uncategorized')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAndSortedStats.map(employee => (
                                        <tr key={employee.name}>
                                            <td>{employee.name}</td>
                                            <td>{employee.rank}</td>
                                            <td>{employee.total}</td>
                                            <td>{employee.categories['DMEC'] || 0}</td>
                                            <td>{employee.categories['PHMC Staff'] || 0}</td>
                                            <td>{employee.categories['OBGYN'] || 0}</td>
                                            <td>{employee.categories['Mental Health'] || 0}</td>
                                            <td>{employee.categories['Uncategorized'] || 0}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </Tab>
                        {categoryStats && Object.entries(categoryStats).sort(([a], [b]) => a.localeCompare(b)).map(([category, data]) => (
                            <Tab eventKey={category} title={`${category} (${data.total})`} key={category}>
                               <Card>
                                    <Card.Header as="h5">Breakdown for {category}</Card.Header>
                                    <Card.Body>
                                        <Table striped bordered hover responsive>
                                            <thead>
                                                <tr>
                                                    <th>Form Name</th>
                                                    <th>Times Used</th>
                                                    <th>% of Category</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(data.forms).sort(([, a], [, b]) => b.total - a.total).map(([formName, formData]) => {
                                                    const rowKey = `${category}-${formName}`;
                                                    const isExpanded = expandedRow === rowKey;
                                                    return(
                                                    <Fragment key={rowKey}>
                                                        <tr onClick={() => handleRowToggle(rowKey)} style={{ cursor: 'pointer' }}>
                                                            <td><i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'} me-2`}></i>{formName}</td>
                                                            <td>{formData.total}</td>
                                                            <td>{((formData.total / data.total) * 100).toFixed(1)}%</td>
                                                        </tr>
                                                        {isExpanded && (
                                                            <tr>
                                                                <td colSpan="3" style={{ backgroundColor: '#f8f9fa' }}>
                                                                    <div style={{ padding: '1rem' }}>
                                                                        <h6>Employee Usage for "{formName}"</h6>
                                                                        <Table size="sm" bordered>
                                                                            <thead>
                                                                                <tr>
                                                                                    <th>Employee Name</th>
                                                                                    <th>Times Used</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {Object.entries(formData.employees).sort(([, a], [, b]) => b - a).map(([empName, count]) => (
                                                                                    <tr key={empName}>
                                                                                        <td>{empName}</td>
                                                                                        <td>{count}</td>
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
                                    </Card.Body>
                               </Card>
                            </Tab>
                        ))}
                    </Tabs>
                </>
            )}
        </div>
    );
};

export default EmployeeManager;
