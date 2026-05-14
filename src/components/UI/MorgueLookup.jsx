import React, { useState, useEffect, useMemo } from 'react';
import { database } from '../../firebase';
import { ref, set } from 'firebase/database';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useGtaWorldAuth } from '../../hooks/useGtaWorldAuth';
import { useNotification } from '../../contexts/NotificationContext';
import AutopsyModal from '../Modals/AutopsyModal';
import SidebarNav from '../UI/SidebarNav';
import * as Sentry from "@sentry/react";
import { reportLogicalError } from '../../utils/errorUtils';

const MorgueLookup = () => {
    const { morgueRecords, factionsData, isLoadingData } = useData();
    const { isPhmcMember, user: firebaseUser } = useAuth();
    const { user: gtawUser, isAuthenticated } = useGtaWorldAuth();
    const { showNotification } = useNotification();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [isReporting, setIsReporting] = useState(false);
    const [devAccessOverride, setDevAccessOverride] = useState(null); // 'employee', 'denied'
    const isLocalHost = window.location.hostname === 'localhost';
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const recordsPerPage = 15;

    // Diagnostic state
    const [showDiagnostics, setShowDiagnostics] = useState(false);

    // Display info for the sidebar
    const userDisplayInfo = useMemo(() => {
        if (!isAuthenticated || !gtawUser) {
            if (isLocalHost && devAccessOverride) {
                 return {
                    name: 'Dev User',
                    dept: devAccessOverride === 'employee' ? 'PHMC Staff' : 'Authorized Personnel'
                };
            }
            return null;
        }

        return {
            name: gtawUser.faction?.characterName || gtawUser.activeCharacter?.characterName || gtawUser.username,
            dept: gtawUser.faction?.rank || (isPhmcMember ? 'PHMC Employee' : 'Authorized Personnel')
        };
    }, [isPhmcMember, gtawUser, isAuthenticated, isLocalHost, devAccessOverride]);

    // Access control logic: Grant access if authenticated or override exists
    const hasAccess = useMemo(() => {
        if (isLocalHost && devAccessOverride) {
            if (devAccessOverride === 'employee') return true;
            return false;
        }

        // Simplifed: Grant access if the user is signed in with GTA World OAuth
        return isAuthenticated;
    }, [isAuthenticated, devAccessOverride, isLocalHost]);

    const effectiveIsPhmcMember = useMemo(() => {
        if (isLocalHost && devAccessOverride === 'employee') return true;
        return isPhmcMember;
    }, [isPhmcMember, devAccessOverride, isLocalHost]);

    const syncStatus = useMemo(() => {
        if (!hasAccess || !morgueRecords || morgueRecords.length === 0) return null;
        const latest = Math.max(...morgueRecords.map(r => r.lastUpdated || 0));
        if (!latest) return null;

        const now = Date.now();
        const cycleMs = 24 * 60 * 60 * 1000;
        const nextUpdate = latest + cycleMs;
        const hoursRemaining = Math.max(0, Math.ceil((nextUpdate - now) / (1000 * 60 * 60)));

        return {
            last: new Date(latest).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
            next: hoursRemaining > 0 ? `${hoursRemaining}h` : 'Soon',
            isOverdue: now > nextUpdate
        };
    }, [morgueRecords, hasAccess]);

    const filteredRecords = useMemo(() => {
        if (!hasAccess || !morgueRecords) return [];
        // Sort by caseId descending
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
        // --- DETAILED AUDIT LOGGING ---
        const oauthName = gtawUser?.username || 'Unknown OAuth';
        const characterName = gtawUser?.faction?.characterName || gtawUser?.activeCharacter?.characterName || 'Unknown Character';
        const timestamp = new Date().toLocaleString();
        
        console.log(`[Audit] USER - ${oauthName} - ${characterName} has accessed CASE #${record.caseId} - ${record.name} at ${timestamp}`);
        
        // Discord Webhook for record access
        const payload = {
            embeds: [{
                title: 'Morgue Record Accessed',
                color: 0x3498db,
                description: `**${characterName}** ((${oauthName})) is viewing a detailed autopsy report.`,
                fields: [
                    { name: 'Case Number', value: String(record.caseId), inline: true },
                    { name: 'Decedent Name', value: record.name, inline: true },
                    { name: 'Time of Death', value: record.timeOfDeath || 'Unknown', inline: true },
                    { name: 'Access Time', value: timestamp, inline: false }
                ],
                footer: { text: 'PHMC Morgue Access Audit' }
            }]
        };

        const webhookUrl = import.meta.env.VITE_DISCORD_WEBHOOK_ADMIN || import.meta.env.VITE_DEV_WEBHOOK;
        if (webhookUrl) {
            fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(err => console.error('Failed to send access audit:', err));
        }

        setSelectedRecord(record);
        setShowModal(true);
    };

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
        // Scroll to top of table
        document.querySelector('.morgue-table-container')?.scrollTo(0, 0);
    };

    const handleReportAccessIssue = async () => {
        if (!isAuthenticated || !gtawUser) return;
        
        setIsReporting(true);
        try {
            const charId = gtawUser.faction?.characterId || gtawUser.faction?.id || 'N/A';
            const factionName = gtawUser.faction?.name || 'N/A';
            const rank = gtawUser.faction?.rank || 'N/A';

            reportLogicalError(
                'Morgue Access Issue Reported',
                `User ${gtawUser.username} reported an access issue while signed in.`,
                {
                    characterName: gtawUser.faction?.characterName || 'Unknown',
                    characterId: charId,
                    faction: factionName,
                    rank: rank,
                    isPhmcMember: isPhmcMember,
                    clientTimestamp: new Date().toISOString()
                }
            );

            showNotification('Access issue report sent to developers. Thank you.', 'success');
        } catch (error) {
            console.error('Failed to report access issue:', error);
            showNotification('Failed to send report.', 'error');
        } finally {
            setIsReporting(false);
        }
    };

    // Hidden shortcut for diagnostics: Ctrl + Alt + D
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'd') {
                const newState = !showDiagnostics;
                setShowDiagnostics(newState);
                
                if (newState) {
                    console.log('[MorgueLookup] Diagnostics Enabled');
                    
                    // resolve identity for logging
                    const charId = gtawUser?.faction?.characterId || gtawUser?.activeCharacter?.characterId || gtawUser?.faction?.id;
                    const charName = gtawUser?.faction?.characterName || gtawUser?.activeCharacter?.characterName;

                    // log a detailed snapshot to Sentry for remote debugging
                    Sentry.captureMessage(`Morgue Access Diagnostic: ${charName || 'Unknown'} (${gtawUser?.username || 'No User'})`, {
                        level: 'info',
                        tags: {
                            component: 'MorgueLookup',
                            access_status: hasAccess ? 'granted' : 'denied',
                            is_phmc: isPhmcMember
                        },
                        extra: {
                            identity: { charId, charName, username: gtawUser?.username, isAuthenticated },
                            access_logic: { hasAccess, isPhmcMember, devAccessOverride, isLocalHost },
                            database: { recordsCount: morgueRecords?.length || 0, filteredCount: filteredRecords?.length || 0 },
                            timestamp: new Date().toISOString()
                        }
                    });
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showDiagnostics, isAuthenticated, gtawUser, hasAccess, isPhmcMember]);

    // Notification for granted access
    useEffect(() => {
        if (hasAccess && isAuthenticated && gtawUser) {
            // Resolve character identity with fallback chain
            const charId = gtawUser.faction?.characterId || gtawUser.activeCharacter?.characterId || gtawUser.faction?.id;
            const charName = gtawUser.faction?.characterName || gtawUser.activeCharacter?.characterName;

            // Don't log if we still don't have a name/id
            if (!charId || !charName) {
                console.log('[MorgueLookup] Access granted but character data not yet resolved. Deferring audit log...');
                return;
            }

            const sessionKey = `morgue_access_notified_${charId}`;
            const hasNotified = sessionStorage.getItem(sessionKey);

            if (!hasNotified) {
                const payload = {
                    embeds: [{
                        title: 'Morgue Lookup Access: GRANTED',
                        color: 0x2ecc71,
                        fields: [
                            { name: 'Username', value: gtawUser.username || 'Unknown', inline: true },
                            { name: 'Character', value: charName, inline: true },
                            { name: 'Character ID', value: String(charId), inline: true },
                            { name: 'Timestamp', value: new Date().toLocaleString(), inline: false }
                        ],
                        footer: { text: 'PHMC Morgue Security Audit' }
                    }]
                };

                const webhookUrl = import.meta.env.VITE_DISCORD_WEBHOOK_ADMIN || import.meta.env.VITE_DEV_WEBHOOK;
                if (webhookUrl) {
                    fetch(webhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    }).catch(err => console.error('Failed to send morgue access notification:', err));
                }
                
                sessionStorage.setItem(sessionKey, 'true');
            }
        }
    }, [hasAccess, isAuthenticated, gtawUser]);

    return (
        <div className="morgue-lookup-page">
            <SidebarNav />
            
            <aside className="morgue-sidebar">
                <div className="morgue-sidebar-header">Morgue Intake System</div>
                
                {userDisplayInfo && (
                    <div className="morgue-user-welcome mb-4 p-3 rounded bg-dark bg-opacity-25 border border-secondary border-opacity-50">
                        <div className="small opacity-75 text-uppercase fw-bold mb-1" style={{ fontSize: '0.65rem', letterSpacing: '1px', color: '#3498db' }}>Welcome Back</div>
                        <div className="fw-bold text-white mb-1" style={{ fontSize: '1.05rem' }}>{userDisplayInfo.name}</div>
                        <div className="small opacity-75" style={{ fontSize: '0.8rem', fontStyle: 'italic' }}>{userDisplayInfo.dept}</div>
                    </div>
                )}

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

                {showDiagnostics && (
                    <div className="morgue-diagnostics-panel p-3 border-bottom bg-info bg-opacity-10">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                            <h6 className="mb-0 text-info fw-bold"><i className="fas fa-microscope me-2"></i>Access Diagnostics</h6>
                            <button className="btn-close btn-close-sm" onClick={() => setShowDiagnostics(false)}></button>
                        </div>
                        <div className="row g-3">
                            <div className="col-md-3">
                                <div className="diag-item">
                                    <label>Authentication</label>
                                    <div className={isAuthenticated ? 'text-success' : 'text-danger'}>
                                        {isAuthenticated ? 'AUTHENTICATED' : 'NOT AUTHENTICATED'}
                                    </div>
                                    <small className="text-muted">{gtawUser?.username || 'No Username'}</small>
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="diag-item">
                                    <label>Access Status</label>
                                    <div className={hasAccess ? 'text-success' : 'text-danger'}>
                                        {hasAccess ? 'GRANTED' : 'DENIED'}
                                    </div>
                                    <div className="diag-tags mt-1">
                                        {isPhmcMember && <span className="badge bg-primary me-1">PHMC</span>}
                                        {isLocalHost && <span className="badge bg-warning text-dark me-1">Local</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="diag-item">
                                    <label>Resolved Identity</label>
                                    <div className="text-truncate" title={userDisplayInfo?.name}>
                                        {userDisplayInfo?.name || 'Unknown'}
                                    </div>
                                    <small className="font-monospace text-muted" style={{ fontSize: '0.7rem' }}>
                                        ID: {gtawUser?.faction?.characterId || gtawUser?.activeCharacter?.characterId || 'None'}
                                    </small>
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="diag-item">
                                    <label>Database State</label>
                                    <div>Records: {morgueRecords?.length || 0}</div>
                                    <small className="text-muted">Filtered: {filteredRecords.length}</small>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

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
                                The Morgue Intake Database contains sensitive information. Access is restricted to authenticated PHMC Employees and authorized Law Enforcement personnel. <br />  <br />Please click the 'Sign In' button below to authenticate with GTA World OAuth. <br />  <br />Any bugs or issues with access, please report using the button below or contact Fr0styDev (Alyson Frost) in the PHMC Discord.
                            </p>
                            <div className="mt-4 d-flex justify-content-center gap-3">
                                {!isAuthenticated && (
                                    <button className="morgue-btn-add px-4 py-2" onClick={() => window.location.hash = '/login'}>
                                        <i className="fas fa-sign-in-alt me-2"></i>Sign In with GTA World
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
                    <div className="me-auto small text-muted opacity-75 d-flex align-items-center">
                        <i className="fas fa-info-circle me-2"></i>
                        Any issues with accessing, please contact Fr0styDev (Alyson Frost) in the PHMC Discord.
                    </div>

                    {syncStatus && (
                        <div className={`morgue-status-badge ${syncStatus.isOverdue ? 'overdue' : ''}`} title="Manual update process (24h cycle)">
                            <i className="fas fa-sync-alt fa-spin-hover me-2"></i>
                            <span className="label">UPDATED:</span>
                            <span className="time">{syncStatus.last}</span>
                            <span className="divider mx-2">|</span>
                            <span className="label">NEXT:</span>
                            <span className="time">{syncStatus.next}</span>
                        </div>
                    )}

                    {hasAccess && (
                        <>
                            {isAuthenticated && (
                                <button 
                                    className="btn btn-outline-warning btn-sm ms-2" 
                                    onClick={handleReportAccessIssue}
                                    disabled={isReporting}
                                >
                                    <i className={`fas ${isReporting ? 'fa-spinner fa-spin' : 'fa-bug'} me-2`}></i>
                                    Report Access Issue
                                </button>
                            )}
                        </>
                    )}
                    {effectiveIsPhmcMember && <button className="morgue-btn-add" onClick={() => window.location.hash = '/admin'}>Admin Panel</button>}
                </footer>
            </main>

            <AutopsyModal 
                show={showModal} 
                onClose={() => setShowModal(false)} 
                record={selectedRecord} 
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

                .morgue-status-badge.overdue {
                    border: 1px solid #e74c3c;
                }

                .morgue-status-badge.overdue .label:last-of-type {
                    color: #e74c3c;
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
