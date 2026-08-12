import React, { useState, useEffect, useCallback } from 'react';
import { database } from '../../firebase';
import { ref, get } from 'firebase/database';
import { Spinner, Table, Button, Badge } from 'react-bootstrap';

const DEPLOY_STATUS_LABELS = {
    queued:          { label: 'Queued', variant: 'warning' },
    deploy_failed:   { label: 'Failed', variant: 'danger' },
    searching:       { label: 'Searching', variant: 'info' },
    replying:        { label: 'Replying', variant: 'primary' },
    posted:          { label: 'Deployed', variant: 'success' },
    topic_not_found: { label: 'No Thread', variant: 'warning' },
    dry_run:         { label: 'Dry Run', variant: 'secondary' },
    reply_failed:    { label: 'Reply Failed', variant: 'danger' },
    error:           { label: 'Error', variant: 'danger' },
};

const FORM_LABELS = {
    // Coroners
    coroner_email:        'Coroner Email',
    coroner_report:       'Coroner Report',
    death_record:         'Death Record',
    autopsy:              'Autopsy',
    'mass-ftality-test':  'Mass Fatality',
    // Clinical Department
    patient_notes:        'Patient Notes',
    er_protocol:          'ER Protocol',
    physical_evaluation:  'Physical Evaluation',
    'staff-patient-file': 'Patient File',
    surgical:             'Surgical',
    // Mental Health
    session_notes:        'Session Notes - Consultation',
    intensive_treatment:  'Intensive Treatment Certification',
    'psych-eval':           'Psych Eval',
};

function getTimeAgo(isoString) {
    if (!isoString) return '—';
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

const BotStatus = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchReports = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const snap = await get(ref(database, 'scheduledReports'));
            if (!snap.exists()) {
                setReports([]);
                setLoading(false);
                return;
            }

            const items = [];
            snap.forEach((authorSnap) => {
                const authorId = authorSnap.key;
                authorSnap.forEach((reportSnap) => {
                    const d = reportSnap.val();
                    items.push({
                        key: reportSnap.key,
                        authorId,
                        title: d.originalKey || reportSnap.key,
                        formId: d.formId || '—',
                        formLabel: FORM_LABELS[d.formId] || d.formId || '—',
                        hasDeployed: d.hasdeployed === true,
                        deployStatus: d.deployStatus || null,
                        deployMessage: d.deployMessage || null,
                        deployRetries: d.deployRetries || 0,
                        deployLastFailedAt: d.deployLastFailedAt || null,
                        deployedAt: d.deployedAt || null,
                        createdAt: d.timestamp || null,
                    });
                });
            });

            // Sort: newest first by creation time (handle string ISO or number timestamp)
            items.sort((a, b) => {
                const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return bTime - aTime;
            });
            setReports(items);
        } catch (err) {
            console.error('[BotStatus] Failed to fetch:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchReports(); }, [fetchReports]);

    // ── Summary counts ──
    const total = reports.length;
    const queued = reports.filter(r => !r.hasDeployed && (!r.deployStatus || r.deployStatus === 'queued')).length;
    const processing = reports.filter(r => !r.hasDeployed && r.deployStatus && r.deployStatus !== 'queued' && r.deployStatus !== 'deploy_failed' && r.deployStatus !== 'error').length;
    const failed = reports.filter(r => r.deployStatus === 'deploy_failed' || r.deployStatus === 'error' || r.deployStatus === 'reply_failed').length;
    const deployed = reports.filter(r => r.hasDeployed).length;

    if (loading && reports.length === 0) {
        return <div className="text-center p-5"><Spinner animation="border" /></div>;
    }

    if (error && reports.length === 0) {
        return <div className="alert alert-danger">Failed to load bot status: {error}</div>;
    }

    return (
        <div className="admin-section">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0 fw-800">
                    <i className="fas fa-robot me-3 text-indigo"></i>PHMC Bot Status
                </h2>
                <div className="d-flex align-items-center gap-3">
                    <span className="text-muted small">{reports.length} reports tracked</span>
                    <Button variant="outline-secondary" size="sm" onClick={fetchReports} disabled={loading}>
                        <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-sync'} me-1`}></i>
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Summary cards */}
            <div className="row g-3 mb-4">
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm bg-opacity-10" style={{ background: 'var(--admin-surface-light)' }}>
                        <div className="card-body text-center py-3">
                            <div className="fs-3 fw-bold text-info">{queued}</div>
                            <div className="small text-muted">Queued / Pending</div>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm bg-opacity-10" style={{ background: 'var(--admin-surface-light)' }}>
                        <div className="card-body text-center py-3">
                            <div className="fs-3 fw-bold text-primary">{processing}</div>
                            <div className="small text-muted">In Progress</div>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm bg-opacity-10" style={{ background: 'var(--admin-surface-light)' }}>
                        <div className="card-body text-center py-3">
                            <div className={`fs-3 fw-bold ${failed > 0 ? 'text-danger' : 'text-success'}`}>{failed}</div>
                            <div className="small text-muted">Failed</div>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm bg-opacity-10" style={{ background: 'var(--admin-surface-light)' }}>
                        <div className="card-body text-center py-3">
                            <div className="fs-3 fw-bold text-success">{deployed}</div>
                            <div className="small text-muted">Deployed</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Report table */}
            {reports.length === 0 ? (
                <div className="text-center p-5 text-muted">No reports found in the deploy system.</div>
            ) : (
                <div className="admin-modern-table">
                    <Table hover responsive className="mb-0">
                        <thead>
                            <tr>
                                <th>Report</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Retries</th>
                                <th>Message</th>
                                <th>Last Updated</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map((r) => {
                                const statusInfo = DEPLOY_STATUS_LABELS[r.deployStatus] || {};
                                return (
                                    <tr key={`${r.authorId}-${r.key}`}>
                                        <td className="fw-bold" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {r.title}
                                        </td>
                                        <td><span className="badge bg-secondary bg-opacity-25 text-light">{r.formLabel}</span></td>
                                        <td>
                                            {r.hasDeployed ? (
                                                <Badge bg="success">Deployed</Badge>
                                            ) : r.deployStatus ? (
                                                <Badge bg={statusInfo.variant || 'secondary'}>{statusInfo.label || r.deployStatus}</Badge>
                                            ) : (
                                                <Badge bg="warning" text="dark">Queued</Badge>
                                            )}
                                        </td>
                                        <td className="text-muted small">
                                            {r.deployRetries > 0 ? `${r.deployRetries}x` : '—'}
                                        </td>
                                        <td className="small text-muted" style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {r.deployMessage || '—'}
                                        </td>
                                        <td className="small text-muted">
                                            {getTimeAgo(r.deployLastFailedAt || r.deployedAt || r.createdAt)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </Table>
                </div>
            )}
        </div>
    );
};

export default BotStatus;
