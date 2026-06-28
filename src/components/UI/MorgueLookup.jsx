import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { database } from '../../firebase';
import { ref, get, set } from 'firebase/database';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useGtaWorldAuth } from '../../hooks/useGtaWorldAuth';
import { useNotification } from '../../contexts/NotificationContext';
import AutopsyModal from '../Modals/AutopsyModal';
import EmployeeCredentialsSection from '../Modals/EmployeeCredentialsSection';
import SidebarNav from '../UI/SidebarNav';
import * as Sentry from "@sentry/react";
import { reportLogicalError } from '../../utils/logging';
import { triggerWebhookProxy } from '../../services/firebaseFunctions';

const MorgueLookup = () => {
    const { morgueRecords, factionsData, isLoadingData } = useData();
    const { isPhmcMember, user: firebaseUser } = useAuth();
    const { user: gtawUser, isAuthenticated } = useGtaWorldAuth();
    const { showNotification } = useNotification();
    const [searchTerm, setSearchTerm] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [isReporting, setIsReporting] = useState(false);
    const [devAccessOverride, setDevAccessOverride] = useState(null); // 'employee', 'denied'
    const [filterByCK, setFilterByCK] = useState(false);
    const isLocalHost = window.location.hostname === 'localhost';
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const recordsPerPage = 15;

    // Diagnostic state
    const [showDiagnostics, setShowDiagnostics] = useState(false);

    // Welcome banner dismissal
    const [welcomeDismissed, setWelcomeDismissed] = useState(
        localStorage.getItem('morgue_welcome_dismissed') === 'true'
    );

    // Dark mode state (default dark)
    const [darkMode, setDarkMode] = useState(() => {
        const saved = localStorage.getItem('morgue_dark_mode');
        return saved !== null ? saved === 'true' : true;
    });

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

        const firstFactionChar = gtawUser?.allFactionCharacters?.[0];
        const fallbackName = firstFactionChar?.character?.characterName || firstFactionChar?.characterName || gtawUser.username;
        const chars = gtawUser?.character || gtawUser?.characters;
        const rawCharName = chars && chars.length > 0 ? (chars[0].characterName || `${chars[0].firstname} ${chars[0].lastname}`.trim() || chars[0].name) : null;
        return {
            name: gtawUser.faction?.characterName || gtawUser.activeCharacter?.characterName || fallbackName || rawCharName || gtawUser.username,
            dept: gtawUser.faction?.rank || (isPhmcMember ? 'PHMC Employee' : 'Authorized Personnel')
        };
    }, [isPhmcMember, gtawUser, isAuthenticated, isLocalHost, devAccessOverride]);

    // Access control logic: Grant access if authenticated or override exists
    const hasAccess = useMemo(() => {
        if (isLocalHost) {
            if (devAccessOverride === 'denied') return false;
            return true;
        }

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
            ((record.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(record.caseId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (record.location || '').toLowerCase().includes(searchQuery.toLowerCase()))
            &&
            (!filterByCK || (record.causeOfDeath || '').includes('((CK))'))
        );
    }, [morgueRecords, searchQuery, hasAccess, filterByCK]);

    // Pagination logic
    const indexOfLastRecord = currentPage * recordsPerPage;
    const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
    const currentRecords = filteredRecords.slice(indexOfFirstRecord, indexOfLastRecord);
    const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);

    const handleViewRecord = (record) => {
        // --- DETAILED AUDIT LOGGING ---
        // Fallback to localStorage if gtawUser state hasn't synced yet
        const getFallbackIdentity = () => {
            try {
                const data = localStorage.getItem('gta-user-data');
                if (data) {
                    const parsed = JSON.parse(data);
                    const chars = parsed?.character || parsed?.characters;
                    const rawCharName = chars && chars.length > 0 ? (chars[0].characterName || `${chars[0].firstname} ${chars[0].lastname}`.trim() || chars[0].name) : null;
                    return {
                        username: parsed?.username,
                        characterName: parsed?.faction?.characterName || parsed?.activeCharacter?.characterName || rawCharName
                    };
                }
            } catch (e) {}
            return { username: null, characterName: null };
        };

        const fallback = getFallbackIdentity();
        const oauthName = gtawUser?.username || fallback.username || 'Unknown OAuth';
        
        const resolveCharName = () => {
            if (gtawUser?.faction?.characterName) return gtawUser.faction.characterName;
            if (gtawUser?.activeCharacter?.characterName) return gtawUser.activeCharacter.characterName;
            const first = gtawUser?.allFactionCharacters?.[0];
            if (first) return first.character?.characterName || first.characterName;
            const chars = gtawUser?.character || gtawUser?.characters;
            if (chars && chars.length > 0) {
                const firstChar = chars[0];
                return firstChar.characterName || `${firstChar.firstname} ${firstChar.lastname}`.trim() || firstChar.name;
            }
            return fallback.characterName;
        };
        const characterName = resolveCharName() || 'Unknown Character';
        const timestamp = new Date().toLocaleString();
        
        // Guard: Prevent viewing if identity is completely unknown (except localhost dev)
        if (!isLocalHost && oauthName === 'Unknown OAuth' && characterName === 'Unknown Character') {
            showNotification("Session not fully loaded. Please refresh and try again.", "warning");
            return;
        }

        console.log(`[Audit] [${isLocalHost ? 'Local Dev' : 'Production'}] USER - ${oauthName} - ${characterName} has accessed CASE #${record.caseId} - ${record.name} at ${timestamp}`);
        
        // Discord Webhook for record access
        const payload = {
            embeds: [{
                title: 'Morgue Record Accessed',
                color: 0x3498db,
                description: `**${characterName}** ((${oauthName})) is viewing a detailed autopsy report.`,
                fields: [
                    { name: 'Environment', value: isLocalHost ? '🔧 Local Dev' : '🌐 Production', inline: true },
                    { name: 'Case Number', value: String(record.caseId), inline: true },
                    { name: 'Decedent Name', value: record.name, inline: true },
                    { name: 'Time of Death', value: record.timeOfDeath || 'Unknown', inline: true },
                    { name: 'Access Time', value: timestamp, inline: false }
                ],
                footer: { text: 'PHMC Morgue Access Audit' }
            }]
        };

        triggerWebhookProxy('admin', payload).catch(err => console.error('Failed to send access audit:', err));

        setSelectedRecord(record);
        setShowModal(true);
    };

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
        // Scroll to top of table
        document.querySelector('.morgue-table-container')?.scrollTo(0, 0);
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
                    const chars = gtawUser?.character || gtawUser?.characters;
                    const rawCharName = chars && chars.length > 0 ? (chars[0].characterName || `${chars[0].firstname} ${chars[0].lastname}`.trim() || chars[0].name) : null;
                    const rawCharId = chars && chars.length > 0 ? chars[0].id : null;

                    const charId = gtawUser?.faction?.characterId || gtawUser?.activeCharacter?.characterId || gtawUser?.faction?.id || rawCharId;
                    const charName = gtawUser?.faction?.characterName || gtawUser?.activeCharacter?.characterName || rawCharName;

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
            const chars = gtawUser?.character || gtawUser?.characters;
            const rawCharName = chars && chars.length > 0 ? (chars[0].characterName || `${chars[0].firstname} ${chars[0].lastname}`.trim() || chars[0].name) : null;
            const rawCharId = chars && chars.length > 0 ? chars[0].id : null;

            const charId = gtawUser.faction?.characterId || gtawUser.activeCharacter?.characterId || gtawUser.faction?.id || rawCharId;
            const charName = gtawUser.faction?.characterName || gtawUser.activeCharacter?.characterName || rawCharName;

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

                triggerWebhookProxy('admin', payload).catch(err => console.error('Failed to send morgue access notification:', err));
                
                sessionStorage.setItem(sessionKey, 'true');
            }
        }
    }, [hasAccess, isAuthenticated, gtawUser]);

    // Diagnostic: compare client-side vs server-side record count on mount
    useEffect(() => {
        if (isLoadingData || !hasAccess || !isAuthenticated) return;

        const sessionKey = 'morgue_diag_compared';
        if (sessionStorage.getItem(sessionKey)) return;
        sessionStorage.setItem(sessionKey, 'true');

        const runDiag = async () => {
            try {
                const key = `morgue_diag_count_${gtawUser?.username || 'anon'}`;
                if (sessionStorage.getItem(key)) return;
                sessionStorage.setItem(key, 'true');

                const snapshot = await get(ref(database, '/morgue-records'));
                const serverCount = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
                const clientCount = morgueRecords?.length || 0;
                const match = serverCount === clientCount;

                triggerWebhookProxy('admin', {
                    embeds: [{
                        title: match ? 'Morgue Data Sync: OK' : 'Morgue Data Sync: MISMATCH',
                        color: match ? 0x2ecc71 : 0xe74c3c,
                        description: match
                            ? `Client cache matches server for **${gtawUser?.username || 'Unknown'}**.`
                            : `Client cache is out of sync for **${gtawUser?.username || 'Unknown'}**.`,
                        fields: [
                            { name: 'Client Records', value: String(clientCount), inline: true },
                            { name: 'Server Records', value: String(serverCount), inline: true },
                            { name: 'Delta', value: String(serverCount - clientCount), inline: true },
                            { name: 'User', value: gtawUser?.username || 'Unknown', inline: true },
                            { name: 'Character', value: userDisplayInfo?.name || 'Unknown', inline: true },
                        ],
                        timestamp: new Date().toISOString(),
                        footer: { text: 'PHMC Morgue Data Integrity Check' }
                    }]
                }).catch(() => {});
            } catch (err) {
                console.warn('[MorgueLookup] Diagnostics failed:', err);
            }
        };

        runDiag();
    }, [isLoadingData, hasAccess, isAuthenticated, morgueRecords, gtawUser, userDisplayInfo]);

    const handleRequestUpdate = useCallback(async () => {
        const payload = {
            content: `<@228306972204597248> user: ${gtawUser?.username || 'Unknown'}, character: ${userDisplayInfo?.name || 'Unknown User'} is requesting a morgue update. Total records: ${morgueRecords?.length || 0}`,
            embeds: [{
                title: 'Morgue Update Requested',
                color: 0xe67e22,
                description: `**${userDisplayInfo?.name || 'Unknown User'}** (${gtawUser?.username || 'Unknown'}) is requesting a manual update of morgue records.`,
                fields: [
                    { name: 'Environment', value: isLocalHost ? '🔧 Local Dev' : '🌐 Production', inline: true },
                    { name: 'Total Records', value: String(morgueRecords?.length || 0), inline: true },
                    { name: 'Request Time', value: new Date().toLocaleString(), inline: false }
                ],
                footer: { text: 'PHMC Morgue Update Request' }
            }]
        };

        try {
            await triggerWebhookProxy('admin', payload);
            showNotification('Request sent - You may be contacted via Discord to keep you updated. If you require a specific entry please contact Fr0styDev on Discord, or PHMC Lobby', 'success');
        } catch {
            showNotification('Failed to send update request. Try again later.', 'error');
        }
    }, [userDisplayInfo, gtawUser, isLocalHost, morgueRecords, showNotification]);

    const toggleDarkMode = () => {
        setDarkMode(prev => {
            const next = !prev;
            localStorage.setItem('morgue_dark_mode', String(next));
            return next;
        });
    };

    return (
        <div className={`morgue-lookup-page ${darkMode ? 'dark-theme' : 'light-theme'}`}>
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
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const query = e.target.value.trim();
                                const count = query
                                    ? (morgueRecords || []).filter(r =>
                                        (r.name || '').toLowerCase().includes(query.toLowerCase()) ||
                                        String(r.caseId || '').toLowerCase().includes(query.toLowerCase()) ||
                                        (r.location || '').toLowerCase().includes(query.toLowerCase())
                                    ).length
                                    : (morgueRecords || []).length;
                                setSearchQuery(query);
                                setCurrentPage(1);
                                triggerWebhookProxy('admin', {
                                    embeds: [{
                                        title: 'Morgue Search',
                                        color: 0x3498db,
                                        description: `**${userDisplayInfo?.name || 'Unknown'}** searched the Morgue database.`,
                                        fields: [
                                            { name: 'Search Term', value: `\`${query || '(none - showing all)'}\``, inline: true },
                                            { name: 'Results', value: String(count), inline: true },
                                            { name: 'Username', value: gtawUser?.username || 'Unknown', inline: true },
                                        ],
                                        timestamp: new Date().toISOString(),
                                        footer: { text: 'PHMC Morgue Usage Analytics' }
                                    }]
                                }).catch(err => {
                                    console.error('[MorgueLookup] Search webhook failed:', err);
                                    triggerWebhookProxy('admin', {
                                        embeds: [{
                                            title: '⚠️ Morgue Search Webhook Failed',
                                            color: 0xffc107,
                                            description: `**User:** ${userDisplayInfo?.name || 'Unknown'}\n**Search:** \`${query || '(none)'}\`\n**Error:** ${err.message || 'Unknown'}`,
                                            timestamp: new Date().toISOString(),
                                        }]
                                    }).catch(() => {});
                                });
                            }
                        }}
                    />
                    <div className="morgue-search-hint">
                        Press Enter to search. You can search by name, case number, or location.
                        {searchQuery && (
                            <button className="morgue-search-reset" onClick={() => { setSearchQuery(''); setSearchTerm(''); setCurrentPage(1); }}>
                                <i className="fas fa-times me-1"></i>Clear
                            </button>
                        )}
                    </div>
                </div>
                {hasAccess && (
                    <div className="morgue-sidebar-info mt-4">
                        <div className="small text-muted mb-2 text-uppercase fw-bold">Filtered Results</div>
                        <div className="display-6 fw-bold">{filteredRecords.length}</div>
                    </div>
                )}

                {hasAccess && (
                    <div className="morgue-sidebar-filter mt-3">
                        <label className="d-flex align-items-center gap-2" style={{ cursor: 'pointer', userSelect: 'none' }}>
                            <input
                                type="checkbox"
                                checked={filterByCK}
                                onChange={(e) => {
                                    setFilterByCK(e.target.checked);
                                    setCurrentPage(1);
                                }}
                            />
                            <span className="small" style={{ color: 'var(--sidebar-text-muted)' }}>
                                <i className="fas fa-skull me-1"></i>CK deaths only
                            </span>
                        </label>
                        <div className="small mt-1" style={{ color: 'var(--text-muted)', fontSize: '0.65rem', lineHeight: 1.3 }}>
                            Relies on Cause of Death field — not an accurate metric
                        </div>
                    </div>
                )}

                {isLocalHost && (
                    <div className="morgue-sidebar-dev p-3 border border-warning rounded bg-dark bg-opacity-25">
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

                <div className="morgue-sidebar-theme-toggle mt-auto">
                    <button className="morgue-theme-btn" onClick={toggleDarkMode} title={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}>
                        <i className={`fas ${darkMode ? 'fa-sun' : 'fa-moon'} me-2`}></i>
                        {darkMode ? 'Light Mode' : 'Dark Mode'}
                    </button>
                </div>
            </aside>

            <main className="morgue-main">
                <header className="morgue-header d-flex justify-content-between align-items-center">
                    <div>
                        <h2 style={{ margin: 0, fontWeight: 700 }}>Active Intake Records</h2>
                        
                    </div>
                </header>

                {hasAccess && !welcomeDismissed && (
                    <div className="morgue-welcome-banner">
                        <div className="morgue-welcome-content">
                            <div className="morgue-welcome-icon"><i className="fas fa-microscope"></i></div>
                            <div className="morgue-welcome-text">
                                <strong>Welcome to the Morgue Intake System.</strong> Records are updated daily. If something is missing, use the <strong>Request Update</strong> button to notify staff.
                            </div>
                        </div>
                        <button 
                            className="morgue-welcome-close" 
                            onClick={() => {
                                localStorage.setItem('morgue_welcome_dismissed', 'true');
                                setWelcomeDismissed(true);
                            }}
                            title="Dismiss"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                )}

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
                                The Morgue Intake Database contains sensitive information. Access is restricted to authenticated PHMC Employees and authorized Law Enforcement personnel.
                            </p>
                            {!isAuthenticated && (
                                <div className="mt-4 mx-auto" style={{ maxWidth: '400px' }}>
                                    <EmployeeCredentialsSection
                                        showNotification={showNotification}
                                        context="Morgue Lookup"
                                    />
                                </div>
                            )}
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
                                            <td colSpan="5">
                                                <div className="text-center p-5 morgue-text-muted">
                                                    <i className="fas fa-search fa-2x mb-3 opacity-25"></i>
                                                    <p className="mb-1">No records found matching your search.</p>
                                                    <p className="small mb-3 opacity-75">
                                                        Records are synced once daily. If the decedent or case you're looking for is recent, it may not have been imported yet.
                                                    </p>
                                                    <button className="morgue-btn-request-update mx-auto d-inline-flex" onClick={handleRequestUpdate}>
                                                        <i className="fas fa-paper-plane me-1"></i>Request Update
                                                    </button>
                                                </div>
                                                <div className="mx-auto mb-4 p-3 rounded bg-warning bg-opacity-10 border border-warning border-opacity-25" style={{ maxWidth: '500px' }}>
                                                    <div className="d-flex align-items-start gap-2">
                                                        <i className="fas fa-lightbulb text-warning mt-1"></i>
                                                        <div className="small morgue-text-muted">
                                                            <strong className="text-warning">Tip:</strong> Try searching by the decedent's full name, case number, or location. If you're sure the record exists in the Morgue Database, use the <strong>Request Update</strong> button above to notify staff or ask Fr0styDev on Discord for a specific entry.
                                                        </div>
                                                    </div>
                                                </div>
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
                    <div className="me-auto small  opacity-75 d-flex align-items-center">
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

                </footer>
            </main>

            <AutopsyModal 
                show={showModal} 
                onClose={() => setShowModal(false)} 
                record={selectedRecord}
                darkMode={darkMode}
            />

            <style>{`
                .morgue-lookup-page.dark-theme {
                    --page-bg: #1a1d21;
                    --surface-bg: #2c2f33;
                    --surface-hover: #36393f;
                    --border-color: #40444b;
                    --text-primary: #dcddde;
                    --text-secondary: #b9bbbe;
                    --text-muted: #8e9297;
                    --text-muted-light: #72767d;
                    --input-bg: #40444b;
                    --input-text: #dcddde;
                    --sidebar-bg: #15171a;
                    --sidebar-border: #40444b;
                    --sidebar-text: #dcddde;
                    --sidebar-text-muted: #b9bbbe;
                    --header-border: #40444b;
                    --table-header-bg: #23262a;
                    --table-header-text: #b9bbbe;
                    --table-header-border: #40444b;
                    --table-row-border: #33363b;
                    --shadow: rgba(0,0,0,0.4);
                    --shadow-sm: rgba(0,0,0,0.3);
                    --shadow-md: rgba(0,0,0,0.5);
                    --accent: #3498db;
                    --accent-hover: #5dade2;
                    --success: #2ea043;
                    --success-hover: #3fb950;
                    --danger: #f14a4a;
                    --danger-hover-bg: rgba(241, 74, 74, 0.15);
                    --warning: #f0a832;
                    --warning-hover: #f5b642;
                    --welcome-bg: linear-gradient(135deg, #1e3250, #2c2f33);
                    --welcome-text: #ffffff;
                    --page-btn-bg: #40444b;
                    --page-btn-hover: #3498db;
                    --page-btn-text: #dcddde;
                    --filtered-results-text: #dcddde;
                }

                .morgue-lookup-page.light-theme {
                    --page-bg: #f4f7f6;
                    --surface-bg: #ffffff;
                    --surface-hover: #f9f9f9;
                    --border-color: #ddd;
                    --text-primary: #333;
                    --text-secondary: #666;
                    --text-muted: #95a5a6;
                    --text-muted-light: #bdc3c7;
                    --input-bg: #ecf0f1;
                    --input-text: #333;
                    --sidebar-bg: #2c3e50;
                    --sidebar-border: #555;
                    --sidebar-text: #ffffff;
                    --sidebar-text-muted: #bdc3c7;
                    --header-border: #ddd;
                    --table-header-bg: #eee;
                    --table-header-text: #666;
                    --table-header-border: #d0d0d0;
                    --table-row-border: #eee;
                    --shadow: rgba(0,0,0,0.2);
                    --shadow-sm: rgba(0,0,0,0.05);
                    --shadow-md: rgba(0,0,0,0.15);
                    --accent: #3498db;
                    --accent-hover: #2980b9;
                    --success: #27ae60;
                    --success-hover: #219150;
                    --danger: #e74c3c;
                    --danger-hover-bg: rgba(231, 76, 60, 0.15);
                    --warning: #e67e22;
                    --warning-hover: #d35400;
                    --welcome-bg: linear-gradient(135deg, #2c3e50, #3498db);
                    --welcome-text: #ffffff;
                    --page-btn-bg: #eee;
                    --page-btn-hover: #3498db;
                    --page-btn-text: #ffffff;
                    --filtered-results-text: inherit;
                }

                .morgue-lookup-page {
                    display: flex;
                    height: 100vh;
                    background-color: var(--page-bg);
                    color: var(--text-primary);
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                }

                .morgue-sidebar {
                    width: 300px;
                    background-color: var(--sidebar-bg);
                    color: var(--sidebar-text);
                    padding: 20px 20px 80px;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 2px 0 5px var(--shadow);
                    z-index: 5;
                }

                .morgue-sidebar-header {
                    font-size: 1.2rem;
                    font-weight: bold;
                    margin-bottom: 30px;
                    border-bottom: 1px solid var(--sidebar-border);
                    padding-bottom: 10px;
                }

                .morgue-search-box label {
                    display: block;
                    font-size: 0.8rem;
                    margin-bottom: 8px;
                    color: var(--sidebar-text-muted);
                }

                .morgue-search-box input {
                    width: 100%;
                    padding: 10px;
                    border-radius: 4px;
                    border: none;
                    background: var(--input-bg);
                    color: var(--input-text);
                }

                .morgue-breadcrumb {
                    color: var(--text-muted);
                }

                .morgue-sidebar-info .text-muted {
                    color: var(--sidebar-text-muted) !important;
                }

                .morgue-text-muted {
                    color: var(--text-muted);
                }

                .morgue-search-hint {
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                    margin-top: 6px;
                    font-size: 0.7rem;
                    color: var(--text-muted);
                }

                .morgue-search-reset {
                    background: none;
                    border: none;
                    color: var(--danger);
                    font-size: 0.7rem;
                    cursor: pointer;
                    padding: 2px 6px;
                    border-radius: 3px;
                    transition: background 0.2s;
                }

                .morgue-search-reset:hover {
                    background: var(--danger-hover-bg);
                }

                .morgue-main {
                    flex-grow: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .morgue-header {
                    padding: 20px;
                    background: var(--surface-bg);
                    border-bottom: 1px solid var(--border-color);
                }

                .morgue-sidebar-info .display-6 {
                    color: var(--filtered-results-text);
                }

                .morgue-sidebar-theme-toggle {
                    margin-top: auto;
                }

                .morgue-theme-btn {
                    width: 100%;
                    background: rgba(255,255,255,0.08);
                    color: var(--sidebar-text);
                    border: 1px solid var(--sidebar-border);
                    border-radius: 6px;
                    padding: 8px 12px;
                    font-size: 0.8rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    opacity: 0.7;
                }

                .morgue-theme-btn:hover {
                    opacity: 1;
                    background: rgba(255,255,255,0.15);
                }

                .morgue-status-badge {
                    background: var(--sidebar-bg);
                    color: var(--sidebar-text);
                    padding: 8px 15px;
                    border-radius: 50px;
                    font-size: 0.85rem;
                    display: flex;
                    align-items: center;
                    box-shadow: 0 2px 5px var(--shadow);
                }

                .morgue-status-badge .label {
                    color: var(--accent);
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
                    padding: 0 20px 20px;
                }

                .morgue-table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                    margin-top: 20px;
                    background: var(--surface-bg);
                    box-shadow: 0 2px 10px var(--shadow-sm);
                    border-radius: 8px;
                }

                .morgue-table th {
                    position: sticky;
                    top: 0;
                    background: var(--table-header-bg);
                    text-align: left;
                    padding: 15px;
                    z-index: 3;
                    text-transform: uppercase;
                    font-size: 0.75rem;
                    letter-spacing: 1px;
                    color: var(--table-header-text);
                    border-bottom: 2px solid var(--table-header-border);
                }

                .morgue-table td {
                    padding: 15px;
                    border-bottom: 1px solid var(--table-row-border);
                }

                .morgue-table tr:hover {
                    background-color: var(--surface-hover);
                }

                .morgue-btn-view {
                    background: var(--success);
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
                    background: var(--success-hover);
                    transform: scale(1.02);
                }

                .morgue-btn-summary {
                    background: var(--accent);
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
                    background: var(--accent-hover);
                    transform: scale(1.02);
                }

                .morgue-page-btn {
                    background: var(--page-btn-bg);
                    border: none;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    color: var(--text-primary);
                }

                .morgue-page-btn:hover:not(:disabled) {
                    background: var(--page-btn-hover);
                    color: var(--page-btn-text);
                }

                .morgue-page-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .morgue-footer {
                    padding: 15px 20px;
                    background: var(--surface-bg);
                    border-top: 1px solid var(--border-color);
                    display: flex;
                    gap: 15px;
                    justify-content: flex-end;
                }

                .morgue-btn-request {
                    background-color: var(--text-muted);
                    color: white;
                    padding: 10px 20px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 600;
                }

                .morgue-btn-request-update {
                    background-color: var(--warning);
                    color: white;
                    padding: 8px 16px;
                    border: none;
                    border-radius: 50px;
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 0.8rem;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    white-space: nowrap;
                }

                .morgue-btn-request-update:hover {
                    background-color: var(--warning-hover);
                    transform: scale(1.02);
                }

                .morgue-btn-add {
                    background-color: var(--sidebar-bg);
                    color: white;
                    padding: 10px 20px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 600;
                }

                .morgue-welcome-banner {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 20px;
                    margin: 0 20px 10px;
                    background: var(--welcome-bg);
                    color: var(--welcome-text);
                    border-radius: 8px;
                    box-shadow: 0 2px 8px var(--shadow-md);
                }

                .morgue-welcome-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 0;
                }

                .morgue-welcome-icon {
                    font-size: 1.4rem;
                    opacity: 0.8;
                }

                .morgue-welcome-text {
                    font-size: 0.9rem;
                    line-height: 1.4;
                }

                .morgue-welcome-close {
                    background: none;
                    border: none;
                    color: var(--welcome-text);
                    opacity: 0.6;
                    cursor: pointer;
                    padding: 4px 8px;
                    font-size: 1.1rem;
                    transition: opacity 0.2s;
                }

                .morgue-welcome-close:hover {
                    opacity: 1;
                }

                .fa-spin-hover:hover {
                    animation: fa-spin 2s infinite linear;
                }

                .morgue-status-badge.overdue {
                    border: 1px solid var(--danger);
                }

                .morgue-status-badge.overdue .label:last-of-type {
                    color: var(--danger);
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
