import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useGtaWorldAuth } from '../../hooks/useGtaWorldAuth';
import { useNotification } from '../../contexts/NotificationContext';
import AutopsyModal from '../Modals/AutopsyModal';
import RequestMorgueAccessModal from '../Modals/RequestMorgueAccessModal';
import SidebarNav from '../UI/SidebarNav';

const MorgueLookup = () => {
    const { morgueRecords, morgueWhitelist, isLoadingData } = useData();
    const { isPhmcMember, user: firebaseUser } = useAuth();
    const { user: gtawUser, isAuthenticated } = useGtaWorldAuth();
    const { showNotification } = useNotification();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [devAccessOverride, setDevAccessOverride] = useState(null); // 'employee', 'whitelist', 'denied'
    const isLocalHost = window.location.hostname === 'localhost';
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const recordsPerPage = 15;

    // Access control logic
    const hasAccess = useMemo(() => {
        if (isLocalHost && devAccessOverride) {
            if (devAccessOverride === 'employee') return true;
            if (devAccessOverride === 'whitelist') return true;
            return false;
        }

        if (!isAuthenticated) return false;
        
        // PHMC Members always have access
        if (isPhmcMember) return true;

        // Check whitelist
        if (morgueWhitelist && gtawUser) {
            const charId = String(gtawUser.faction?.characterId || gtawUser.faction?.id || '');
            const username = gtawUser.username?.toLowerCase();
            
            // Check if character ID or username is whitelisted
            return Object.values(morgueWhitelist).some(entry => {
                const entryVal = String(entry.id || entry.username || entry).toLowerCase();
                return entryVal === charId || entryVal === username;
            });
        }

        return false;
    }, [isAuthenticated, isPhmcMember, morgueWhitelist, gtawUser, devAccessOverride, isLocalHost]);

    const effectiveIsPhmcMember = useMemo(() => {
        if (isLocalHost && devAccessOverride === 'employee') return true;
        return isPhmcMember;
    }, [isPhmcMember, devAccessOverride, isLocalHost]);

    const lastUpdatedTime = useMemo(() => {
        if (!hasAccess || !morgueRecords || morgueRecords.length === 0) return null;
        const latest = Math.max(...morgueRecords.map(r => r.lastUpdated || 0));
        return latest ? new Date(latest).toLocaleString() : null;
    }, [morgueRecords, hasAccess]);

    const filteredRecords = useMemo(() => {
        if (!hasAccess || !morgueRecords) return [];
        // Sort by caseId descending (highest case # first)
        const sorted = [...morgueRecords].sort((a, b) => {
            const caseA = Number(a.caseId) || 0;
            const caseB = Number(b.caseId) || 0;
            return caseB - caseA;
        });

        return sorted.filter(record => 
            (record.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(record.caseId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (record.location || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [morgueRecords, searchTerm, hasAccess]);

    // Pagination logic
    const indexOfLastRecord = currentPage * recordsPerPage;
    const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
    const currentRecords = filteredRecords.slice(indexOfFirstRecord, indexOfLastRecord);
    const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);

    const handleViewRecord = (record) => {
        setSelectedRecord(record);
        setShowModal(true);
    };

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
        // Scroll to top of table
        document.querySelector('.morgue-table-container')?.scrollTo(0, 0);
    };

    return (
        <div className="morgue-lookup-page">
            <SidebarNav />
            
            <aside className="morgue-sidebar">
                <div className="morgue-sidebar-header">Morgue Intake System</div>
                <div className="morgue-search-box">
                    <label htmlFor="decedentSearch">DECEDENT LOOKUP</label>
                    <input 
                        type="text" 
                        id="decedentSearch" 
                        placeholder="Enter name, case #..." 
                        value={searchTerm}
                        disabled={!hasAccess}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1); // Reset to first page on search
                        }}
                    />
                </div>
                {hasAccess && (
                    <div className="morgue-sidebar-info mt-4">
                        <div className="small text-muted mb-2 text-uppercase fw-bold">Filtered Results</div>
                        <div className="display-6 fw-bold">{filteredRecords.length}</div>
                    </div>
                )}

                {isLocalHost && (
                    <div className="morgue-sidebar-dev mt-auto p-3 border border-warning rounded bg-dark bg-opacity-25">
                        <div className="small text-warning mb-2 text-uppercase fw-bold"><i className="fas fa-tools me-2"></i>Dev Access Override</div>
                        <div className="d-flex flex-column gap-2">
                            <button 
                                className={`btn btn-sm ${devAccessOverride === 'employee' ? 'btn-success' : 'btn-outline-success text-light'}`}
                                onClick={() => setDevAccessOverride(devAccessOverride === 'employee' ? null : 'employee')}
                            >
                                Simulate Employee
                            </button>
                            <button 
                                className={`btn btn-sm ${devAccessOverride === 'whitelist' ? 'btn-primary' : 'btn-outline-primary text-light'}`}
                                onClick={() => setDevAccessOverride(devAccessOverride === 'whitelist' ? null : 'whitelist')}
                            >
                                Simulate Whitelist
                            </button>
                            <button 
                                className={`btn btn-sm ${devAccessOverride === 'denied' ? 'btn-danger' : 'btn-outline-danger text-light'}`}
                                onClick={() => setDevAccessOverride(devAccessOverride === 'denied' ? null : 'denied')}
                            >
                                Simulate Denied
                            </button>
                        </div>
                        {devAccessOverride && (
                            <button className="btn btn-link btn-sm text-muted mt-2 p-0 w-100 text-decoration-none" onClick={() => setDevAccessOverride(null)}>
                                Clear Override
                            </button>
                        )}
                    </div>
                )}
            </aside>

            <main className="morgue-main">
                <header className="morgue-header d-flex justify-content-between align-items-center">
                    <div>
                        <h2 style={{ margin: 0, fontWeight: 700 }}>Active Intake Records</h2>
                        <div className="morgue-breadcrumb small text-muted">Tools &gt; Morgue Intake</div>
                    </div>
                </header>

                <div className="morgue-table-container">
                    {isLoadingData ? (
                        <div className="text-center p-5">
                            <i className="fas fa-circle-notch fa-spin fa-3x mb-3 text-primary"></i>
                            <p className="text-muted">Synchronizing with Morgue Database...</p>
                        </div>
                    ) : !hasAccess ? (
                        <div className="text-center p-5 mt-5">
                            <div className="access-denied-icon mb-4">
                                <i className="fas fa-lock fa-4x text-danger opacity-50"></i>
                            </div>
                            <h3 className="fw-bold">Access Restricted</h3>
                            <p className="text-muted mx-auto" style={{ maxWidth: '500px' }}>
                                The Morgue Intake Database contains sensitive information. Access is restricted to PHMC Employees and authorized Law Enforcement personnel.
                            </p>
                            <div className="mt-4 d-flex justify-content-center gap-3">
                                <button className="morgue-btn-request px-4 py-2" onClick={() => setShowRequestModal(true)}>
                                    <i className="fas fa-paper-plane me-2"></i>Request Access
                                </button>
                                {!isAuthenticated && (
                                    <button className="morgue-btn-add px-4 py-2" onClick={() => window.location.hash = '/login'}>
                                        <i className="fas fa-sign-in-alt me-2"></i>Sign In
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <>
                            <table className="morgue-table">
                                <thead>
                                    <tr>
                                        <th>Case #</th>
                                        <th>Name</th>
                                        <th>Time of Death</th>
                                        <th>Location</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentRecords.length > 0 ? (
                                        currentRecords.map((record) => (
                                            <tr key={record.firebaseKey}>
                                                <td><span className="badge bg-secondary opacity-75">{record.caseId}</span></td>
                                                <td><strong>{record.name}</strong></td>
                                                <td>{record.timeOfDeath}</td>
                                                <td><span className="small">{record.location}</span></td>
                                                <td>
                                                    <div className="d-flex flex-column gap-1">
                                                        <button 
                                                            className="morgue-btn-view" 
                                                            onClick={() => handleViewRecord(record)}
                                                        >
                                                            View Morgue Data
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="5" className="text-center p-5 text-muted">
                                                <i className="fas fa-search fa-2x mb-3 opacity-25"></i>
                                                <p>No records found matching your search.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                            
                            {totalPages > 1 && (
                                <div className="morgue-pagination d-flex justify-content-center align-items-center p-4">
                                    <button 
                                        className="morgue-page-btn" 
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                    >
                                        <i className="fas fa-chevron-left"></i>
                                    </button>
                                    
                                    <div className="mx-3">
                                        Page <span className="fw-bold">{currentPage}</span> of {totalPages}
                                    </div>

                                    <button 
                                        className="morgue-page-btn" 
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                    >
                                        <i className="fas fa-chevron-right"></i>
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <footer className="morgue-footer">
                    {lastUpdatedTime && (
                        <div className="morgue-status-badge">
                            <i className="fas fa-sync-alt fa-spin-hover me-2"></i>
                            <span className="label">LATEST UPDATE:</span>
                            <span className="time">{lastUpdatedTime}</span>
                        </div>
                    )}

                    <button className="morgue-btn-request" onClick={() => setShowRequestModal(true)}>Request Access</button>
                    {effectiveIsPhmcMember && <button className="morgue-btn-add" onClick={() => window.location.hash = '/admin'}>Admin Panel</button>}
                </footer>
            </main>

            <AutopsyModal 
                show={showModal} 
                onClose={() => setShowModal(false)} 
                record={selectedRecord} 
            />

            <RequestMorgueAccessModal
                show={showRequestModal}
                onHide={() => setShowRequestModal(false)}
                showNotification={showNotification}
            />

            <style>{`
                .morgue-lookup-page {
                    display: flex;
                    height: 100vh;
                    background-color: #f4f7f6;
                    color: #333;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                }

                .morgue-sidebar {
                    width: 300px;
                    background-color: #2c3e50;
                    color: white;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 2px 0 5px rgba(0,0,0,0.1);
                    z-index: 5;
                }

                .morgue-sidebar-header {
                    font-size: 1.2rem;
                    font-weight: bold;
                    margin-bottom: 30px;
                    border-bottom: 1px solid #555;
                    padding-bottom: 10px;
                }

                .morgue-search-box label {
                    display: block;
                    font-size: 0.8rem;
                    margin-bottom: 8px;
                    color: #bdc3c7;
                }

                .morgue-search-box input {
                    width: 100%;
                    padding: 10px;
                    border-radius: 4px;
                    border: none;
                    background: #ecf0f1;
                    color: #333;
                }

                .morgue-main {
                    flex-grow: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .morgue-header {
                    padding: 20px;
                    background: white;
                    border-bottom: 1px solid #ddd;
                }

                .morgue-status-badge {
                    background: #2c3e50;
                    color: white;
                    padding: 8px 15px;
                    border-radius: 50px;
                    font-size: 0.85rem;
                    display: flex;
                    align-items: center;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                }

                .morgue-status-badge .label {
                    color: #3498db;
                    font-weight: 800;
                    margin-right: 8px;
                    font-size: 0.7rem;
                }

                .morgue-status-badge .time {
                    font-weight: 600;
                }

                .morgue-table-container {
                    flex-grow: 1;
                    overflow-y: auto;
                    padding: 20px;
                }

                .morgue-table {
                    width: 100%;
                    border-collapse: collapse;
                    background: white;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                    border-radius: 8px;
                    overflow: hidden;
                }

                .morgue-table th {
                    position: sticky;
                    top: 0;
                    background: #eee;
                    text-align: left;
                    padding: 15px;
                    z-index: 2;
                    text-transform: uppercase;
                    font-size: 0.75rem;
                    letter-spacing: 1px;
                    color: #666;
                }

                .morgue-table td {
                    padding: 15px;
                    border-bottom: 1px solid #eee;
                }

                .morgue-table tr:hover {
                    background-color: #f9f9f9;
                }

                .morgue-btn-view {
                    background: #27ae60;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 0.8rem;
                    padding: 6px 12px;
                    transition: all 0.2s;
                }

                .morgue-btn-view:hover {
                    background: #219150;
                    transform: scale(1.02);
                }

                .morgue-btn-summary {
                    background: #3498db;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 0.75rem;
                    padding: 4px 10px;
                    transition: all 0.2s;
                }

                .morgue-btn-summary:hover {
                    background: #2980b9;
                    transform: scale(1.02);
                }

                .morgue-page-btn {
                    background: #eee;
                    border: none;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .morgue-page-btn:hover:not(:disabled) {
                    background: #3498db;
                    color: white;
                }

                .morgue-page-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .morgue-footer {
                    padding: 15px 20px;
                    background: white;
                    border-top: 1px solid #ddd;
                    display: flex;
                    gap: 15px;
                    justify-content: flex-end;
                }

                .morgue-btn-request {
                    background-color: #95a5a6;
                    color: white;
                    padding: 10px 20px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 600;
                }

                .morgue-btn-add {
                    background-color: #2c3e50;
                    color: white;
                    padding: 10px 20px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 600;
                }

                .fa-spin-hover:hover {
                    animation: fa-spin 2s infinite linear;
                }

                @media (max-width: 768px) {
                    .morgue-sidebar {
                        display: none;
                    }
                }
            `}</style>
        </div>
    );
};

export default MorgueLookup;
