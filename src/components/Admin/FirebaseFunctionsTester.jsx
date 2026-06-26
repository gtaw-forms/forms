import React, { useState, useEffect } from 'react';
import { Button, Spinner, Alert, Form } from 'react-bootstrap';
import {
    triggerValidateGtaWorldToken,
    triggerUploadFactionData,
    triggerCheckFactionMembership,
    triggerTestHealthAlert,
    triggerFetchExternalUrl,
    triggerManualMaintenance
} from '../../services/firebaseFunctions';

import { database } from '../../firebase';
import { ref, set, onValue, off } from 'firebase/database';
import { logAdminAction, getUserContext } from '../../utils/logging';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';

const MAINTENANCE_MODE_PATH = 'appMetadata/maintenanceMode';

const FirebaseFunctionsTester = ({ showInAppNotification }) => {
    const { user: gtawUser, username: gtawUsername } = useGtaWorldAuth();
    const [loading, setLoading] = useState(false);
    const [maintenanceLoading, setMaintenanceLoading] = useState(false);
    const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
    const [result, setResult] = useState(null);
    const [authCode, setAuthCode] = useState('');
    const [redirectUri, setRedirectUri] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [characterId, setCharacterId] = useState('');
    const [factionId, setFactionId] = useState('364'); // Default to PHMC faction
    const [factionData, setFactionData] = useState('');
    const [metadata, setMetadata] = useState('');
    const [characterIds, setCharacterIds] = useState('');
    const [externalUrl, setExternalUrl] = useState('https://phmc.gta.world/viewforum.php?f=265');
    const [cookie, setCookie] = useState('');
    const [activeCount, setActiveCount] = useState(0);
    const [todayVisitors, setTodayVisitors] = useState(0);

    const handleTriggerGlobalKillSwitch = async () => {
        const confirmFirst = window.confirm("EXTREMELY DANGEROUS: Are you sure you want to trigger a GLOBAL STORAGE CLEARANCE?\n\nThis will FORCE EVERY USER to log out and clear their local/session storage instantly \n\n Only use this for critical security fixes.");
        if (!confirmFirst) return;

        const confirmSecond = window.prompt("To confirm, type 'PURGE' in all caps below:");
        if (confirmSecond !== 'PURGE') return;

        setLoading(true);
        try {
            const { userAgent, timeZone } = getUserContext();
            const killSwitchRef = ref(database, 'appMetadata/globalKillSwitch');
            const timestamp = Date.now();
            
            await set(killSwitchRef, timestamp);

            logAdminAction(
                gtawUsername || 'Unknown Admin',
                'Triggered Global Kill-Switch',
                `Action: Global Storage Purge triggered at ${new Date(timestamp).toISOString()}`,
                'Security/Developer Tools',
                userAgent,
                timeZone,
                gtawUsername,
                gtawUser
            );

            showInAppNotification('GLOBAL KILL-SWITCH TRIGGERED. Every client will now be purged.', 'success');
        } catch (err) {
            console.error('[Kill-Switch] Trigger failed:', err);
            showInAppNotification(`Failed to trigger kill-switch: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const maintenanceRef = ref(database, MAINTENANCE_MODE_PATH);
        const handleValue = (snapshot) => {
            setMaintenanceEnabled(!!snapshot.val());
        };
        onValue(maintenanceRef, handleValue);
        return () => off(maintenanceRef, 'value', handleValue);
    }, []);

    // Live user presence tracking
    useEffect(() => {
        const presenceRef = ref(database, 'presence');
        const handlePresence = (snapshot) => {
            const val = snapshot.val();
            setActiveCount(val ? Object.keys(val).length : 0);
        };
        onValue(presenceRef, handlePresence);
        return () => off(presenceRef, 'value', handlePresence);
    }, []);

    // Today's unique visitor tracking
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        const visitorRef = ref(database, `analytics/visitors/${today}`);
        const handleVisitors = (snapshot) => {
            const val = snapshot.val();
            setTodayVisitors(val ? Object.keys(val).length : 0);
        };
        onValue(visitorRef, handleVisitors);
        return () => off(visitorRef, 'value', handleVisitors);
    }, []);

    const handleToggleMaintenanceMode = async () => {
        const newState = !maintenanceEnabled;
        setMaintenanceLoading(true);
        try {
            const { userAgent, timeZone } = getUserContext();
            const maintenanceRef = ref(database, MAINTENANCE_MODE_PATH);
            await set(maintenanceRef, newState ? Date.now() : null);

            logAdminAction(
                gtawUsername || 'Unknown Admin',
                newState ? 'Maintenance Mode Enabled' : 'Maintenance Mode Disabled',
                `Maintenance mode ${newState ? 'enabled' : 'disabled'} at ${new Date().toISOString()}`,
                'Developer Tools',
                userAgent,
                timeZone,
                gtawUsername,
                gtawUser
            );

            showInAppNotification(`Maintenance mode ${newState ? 'enabled' : 'disabled'}.`, 'success');
        } catch (err) {
            console.error('[Maintenance] Toggle failed:', err);
            showInAppNotification(`Failed to toggle maintenance mode: ${err.message}`, 'error');
        } finally {
            setMaintenanceLoading(false);
        }
    };

    const handleTriggerFunction = async (func, ...args) => {
        setLoading(true);
        setResult(null);
        try {
            const response = await func(...args);
            setResult(response);
            showInAppNotification('Function triggered successfully. Check console for details.', 'success');
        } catch (error) {
            setResult({ error: error.message });
            showInAppNotification(`Error triggering function: ${error.message}`, 'error');
        }
        setLoading(false);
    };

    return (
        <div className="card">
            <div className="card-header">
                <h6 className="mb-0">Firebase Functions Remote Trigger</h6>
            </div>
            <div className="card-body">
                <p className="text-muted small">Scheduled functions (dailyTaskHandler, weeklyDuplicateReportsCleanup) cannot be triggered directly from the client. Use Firebase Console or CLI for manual triggers.</p>
                
                <h7 className="mt-3">Maintenance Tasks</h7>
                <div className="d-flex flex-wrap gap-2 mb-3">
                    <Button variant="warning" size="sm" onClick={() => handleTriggerFunction(triggerManualMaintenance)} disabled={loading}>
                        {loading ? <Spinner as="span" animation="border" size="sm" /> : 'Trigger Manual Maintenance'}
                    </Button>
                    <p className="text-muted small w-100">Manually runs the daily maintenance task, which includes bingo board resets, report cleanup, and other routine jobs.</p>
                    <div className="d-flex align-items-center gap-3 w-100 border rounded p-2">
                        <span className="fw-semibold small">Maintenance Mode</span>
                        <span className={`badge ${maintenanceEnabled ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                            {maintenanceEnabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                        <Button
                            variant={maintenanceEnabled ? 'success' : 'warning'}
                            size="sm"
                            onClick={handleToggleMaintenanceMode}
                            disabled={maintenanceLoading}
                        >
                            {maintenanceLoading ? <Spinner as="span" animation="border" size="sm" /> : maintenanceEnabled ? 'Disable' : 'Enable'}
                        </Button>
                        <p className="text-muted small mb-0 ms-2">Shows a global banner to all users when enabled.</p>
                    </div>
                </div>

                <h7 className="mt-3">Developer Debug Tools</h7>
                <div className="d-flex flex-wrap gap-2 mb-3">
                    <Button variant="outline-danger" size="sm" onClick={() => {
                        console.critical("Manual Test CRITICAL Error triggered via Admin Dashboard.");
                        showInAppNotification("Test Critical Error triggered. Check Discord & Sentry.", "info");
                    }}>
                        Trigger console.critical
                    </Button>
                    <Button variant="outline-danger" size="sm" onClick={() => {
                        console.error("Standard console.error (Only Discord if Sentry blocked)");
                        showInAppNotification("Standard error triggered. Only Discord if Sentry blocked.", "info");
                    }}>
                        Trigger console.error
                    </Button>
                    <Button variant="outline-warning" size="sm" onClick={() => {
                        console.warn("[CRITICAL] PHMC Debug: Manual Test Warning triggered.");
                        showInAppNotification("Test Warning triggered. Check Discord.", "info");
                    }}>
                        Trigger console.warn
                    </Button>
                    <Button variant="outline-secondary" size="sm" onClick={() => {
                        throw new Error("PHMC Unhandled Exception Test: This is a manual test of the global error listener.");
                    }}>
                        Trigger Unhandled Exception
                    </Button>
                </div>

                <h7 className="mt-3">Live Platform Stats</h7>
                <div className="d-flex flex-wrap gap-3 mb-3 border rounded p-3 bg-dark bg-opacity-10">
                    <div className="d-flex flex-column align-items-center" style={{ minWidth: 120 }}>
                        <span className="h3 mb-0 fw-bold">{activeCount}</span>
                        <span className="small">Active Users</span>
                        <span className="text-muted" style={{ fontSize: '0.7rem' }}>tabs open now</span>
                    </div>
                    <div className="d-flex flex-column align-items-center" style={{ minWidth: 120 }}>
                        <span className="h3 mb-0 fw-bold">{todayVisitors}</span>
                        <span className="small">Today's Visitors</span>
                        <span className="text-muted" style={{ fontSize: '0.7rem' }}>incl. closed tabs</span>
                    </div>
                </div>

                <h7 className="mt-3 text-danger">EXTREMELY DANGEROUS - SECURITY & DEVELOPER TOOLS</h7>
                <div className="d-flex flex-wrap gap-2 mb-3 border border-danger p-3 rounded bg-danger bg-opacity-10">
                    <Button variant="danger" size="lg" className="w-100 fw-bold" onClick={handleTriggerGlobalKillSwitch} disabled={loading}>
                        {loading ? <Spinner as="span" animation="border" size="sm" /> : <><i className="fas fa-radiation-alt me-2"></i> TRIGGER GLOBAL STORAGE PURGE</>}
                    </Button>
                    <p className="text-danger small w-100 mt-2 mb-0">
                        <strong>WARNING:</strong> This action will instantly FORCE LOGOUT every single active user on the platform by wiping their <code>localStorage</code> and <code>sessionStorage</code>. 
                        Use this ONLY in case of extreme data corruption, security breach, or platform-wide cache desync.
                    </p>
                </div>

                {result && (
                    <Alert variant={result.error ? 'danger' : 'success'} className="mt-3">
                        <pre style={{ maxHeight: '300px', overflowY: 'scroll', fontSize: '0.8em' }}>{JSON.stringify(result, null, 2)}</pre>
                    </Alert>
                )}
            </div>
        </div>
    );
};

export default FirebaseFunctionsTester;