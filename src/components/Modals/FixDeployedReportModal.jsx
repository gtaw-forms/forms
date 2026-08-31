import React, { useEffect, useMemo } from 'react';
import { Button, Spinner } from 'react-bootstrap';

// Forms whose forum posts can be edited in place. Autopsy + coroner_email are
// deliberately excluded — those flows are heavily automated / PM-based.
const EDIT_FORMS = ['coroner-report', 'death_record', 'mass-ftality-test',
    'patient_notes', 'er_protocol', 'physical_evaluation', 'staff-patient-file', 'surgical',
    'session_notes', 'intensive_treatment', 'psych-eval', 'general_consultation'];

const statusColor = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'deployed' || s === 'edited') return '#33D6C0';
    if (s === 'queued' || s === 'pending' || s === 'searching' || s === 'replying') return '#f0b429';
    if (s === 'failed' || s === 'failed_permanent' || s === 'error' || s === 'topic_not_found' || s.includes('fail')) return '#f85149';
    return '#8b949e';
};

// This flow edits the PHMC forum post only — the worker drives the PHMC forum client,
// so LSSD/LSPD crossposts and PM/email deliveries can never be touched here.
const isPhmcPost = (url) => /^https:\/\/phmc\.gta\.world\//.test(String(url || ''));

const FixDeployedReportModal = ({
    show,
    onHide,
    reports = [],
    isLoadingReports,
    currentUserId,
    onLoadReports,
    loadReport,
    onEditReport,
}) => {
    useEffect(() => {
        if (show && currentUserId && reports.length === 0 && !isLoadingReports) {
            if (onLoadReports) onLoadReports(currentUserId);
        }
    }, [show, currentUserId, reports.length, isLoadingReports, onLoadReports]);

    const eligible = useMemo(() => reports.filter((r) =>
        EDIT_FORMS.includes(r.formId) && r.hasdeployed === true
    ), [reports]);

    if (!show) return null;

    return (
        <div className="modal-overlay open" onClick={onHide} style={{ display: 'flex', zIndex: 1060 }}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 860 }}>
                <div className="modal-head">
                    <h3><i className="fas fa-pen" style={{ color: '#33D6C0' }} /> Fix Deployed Report</h3>
                    <button className="modal-close" onClick={onHide} aria-label="Close">✕</button>
                </div>
                <div className="modal-body">
                    <p style={{ color: '#8b949e', fontSize: 12.5, marginBottom: 14, lineHeight: 1.5 }}>
                        Spotted a mistake after posting? <strong>Edit &amp; Repost</strong> loads the report into the form —
                        fix the data (e.g. broken image links), then Save &amp; Edit Deployed Post. The bot overwrites the
                        original forum post in place — no duplicate thread.
                    </p>
                    <div style={{
                        marginBottom: 14, padding: '9px 11px', borderRadius: 6, fontSize: 11.5,
                        background: 'var(--amber-dim)', border: '1px solid var(--amber)', color: 'var(--amber)',
                        display: 'flex', gap: 7, alignItems: 'flex-start', lineHeight: 1.5,
                    }}>
                        <i className="fas fa-exclamation-triangle" style={{ marginTop: 2 }} />
                        <span>
                            <strong>PHMC posts only.</strong> This flow edits the PHMC forum post in place. LSSD/LSPD
                            crossposts and PM/email deliveries (e.g. coroner emails) are <strong>not</strong> updated —
                            those are separate posts and would need separate correction.
                        </span>
                    </div>
                    {isLoadingReports ? (
                        <div style={{ padding: 30, textAlign: 'center' }}>
                            <Spinner animation="border" variant="primary" />
                            <p style={{ marginTop: 8, color: '#8b949e' }}>Loading reports...</p>
                        </div>
                    ) : eligible.length === 0 ? (
                        <div style={{ padding: 30, textAlign: 'center', color: '#8b949e' }}>
                            <i className="fas fa-check-circle fa-3x mb-3" style={{ opacity: 0.4 }} />
                            <p>No deployed reports to edit. Reports appear here once they&apos;ve been posted to the forum.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#161b22', borderBottom: '1px solid #30363d' }}>
                                        <th style={{ padding: 12, textAlign: 'left', color: '#8b949e', fontWeight: '600' }}>Report</th>
                                        <th style={{ padding: 12, textAlign: 'left', color: '#8b949e', fontWeight: '600' }}>Status</th>
                                        <th style={{ padding: 12, textAlign: 'right', color: '#8b949e', fontWeight: '600' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {eligible.map((report) => (
                                        <tr key={report.key} style={{ borderBottom: '1px solid #30363d' }}>
                                            <td style={{ padding: 12, color: '#e6edf3' }}>{report.originalKey}</td>
                                            <td style={{ padding: 12, fontSize: '0.9em' }}>
                                                <span style={{ color: statusColor(report.deployStatus) }}>
                                                    {report.deployStatus || 'Deployed'}
                                                </span>
                                                {report.lastEditStatus === 'failed' && report.lastEditError && (
                                                    <span style={{ display: 'block', color: '#f85149', fontSize: '0.85em' }} title={report.lastEditError}>
                                                        Edit failed — {report.lastEditError}
                                                    </span>
                                                )}
                                                {report.deployStatus === 'edited' && report.deployEditedAt && (
                                                    <span style={{ display: 'block', color: '#7d8590', fontSize: '0.85em' }}>
                                                        Edited {new Date(report.deployEditedAt).toLocaleString()}
                                                    </span>
                                                )}
                                                {report.deployUrl && (
                                                    <a href={report.deployUrl} target="_blank" rel="noopener noreferrer"
                                                        style={{ display: 'block', color: '#33D6C0', fontSize: '0.85em' }}>
                                                        View post ↗
                                                    </a>
                                                )}
                                            </td>
                                            <td style={{ padding: 12, textAlign: 'right' }}>
                                                {report.deployUrl && isPhmcPost(report.deployUrl) ? (
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        style={{ fontWeight: 600 }}
                                                        onClick={() => {
                                                            if (loadReport) loadReport(report, currentUserId);
                                                            if (onEditReport) onEditReport({ key: report.key, label: report.originalKey });
                                                            onHide();
                                                        }}
                                                    >
                                                        <i className="fas fa-pen me-1" /> Edit &amp; Repost
                                                    </Button>
                                                ) : report.deployUrl ? (
                                                    <span style={{ color: '#7d8590', fontSize: 11 }} title="This report's primary post is not on the PHMC forum (LSSD/LSPD crosspost or PM) — only PHMC posts are editable here.">
                                                        Not editable here (non-PHMC post)
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#7d8590', fontSize: 11 }} title={'Posted before edit support existed — re-saving it records the target so it can be edited later.'}>
                                                        Not editable (posted before edit support)
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <p style={{ color: '#7d8590', fontSize: 11, marginTop: 12 }}>
                        Edits are applied by the bot on the next recovery sweep (~10 min). Only reports you posted are listed here.
                        Reports marked &quot;not editable&quot; were posted before edit support — re-saving them will record the target for future edits.
                    </p>
                </div>
                <div className="modal-foot">
                    <Button variant="secondary" onClick={onHide}>Close</Button>
                </div>
            </div>
        </div>
    );
};

export default FixDeployedReportModal;
