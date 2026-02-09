import React, { useState, useEffect } from 'react';
import { Table, Button, Spinner, Alert, Card, Badge, ListGroup } from 'react-bootstrap';
import { database } from '../../firebase';
import { ref, remove, onValue, update } from 'firebase/database';
import { logAdminAction, getUserContext } from '../../utils/adminLogger';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { useAuth } from '../../contexts/AuthContext';
import * as Sentry from "@sentry/react";

const AgencyIncidentManager = () => {
    const { user: gtawUser, characterName: currentAdminName, username: gtawUsername } = useGtaWorldAuth();
    const { currentUser: firebaseUser } = useAuth();
    const { showNotification } = useNotification();
    
    const [incidents, setIncidents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [showDetail, setShowDetail] = useState(false);

    useEffect(() => {
        const incidentsRef = ref(database, 'agency_incidents');
        const unsubscribe = onValue(incidentsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                })).sort((a, b) => b.timestamp - a.timestamp);
                setIncidents(list);
            } else {
                setIncidents([]);
            }
            setIsLoading(false);
        }, (err) => {
            console.error("Error fetching incidents:", err);
            setError("Failed to load incidents.");
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleDelete = async (id, incidentLabel) => {
        if (!window.confirm(`Are you sure you want to delete the incident report for ${incidentLabel}?`)) return;

        try {
            const { userAgent, timeZone } = getUserContext();
            await remove(ref(database, `agency_incidents/${id}`));
            logAdminAction(
                gtawUsername || firebaseUser?.email || 'Unknown',
                'Deleted Agency Incident',
                `Incident ID: ${id} | Agency: ${incidentLabel}`,
                'Agency Incident Manager',
                userAgent,
                timeZone,
                gtawUsername,
                gtawUser
            );
            if (selectedIncident?.id === id) setShowDetail(false);
        } catch (err) {
            console.error("Error deleting incident:", err);
            showNotification("Failed to delete incident.", "error");
        }
    };


    const handleView = (incident) => {
        setSelectedIncident(incident);
        setShowDetail(true);
    };

    const activityLogs = React.useMemo(() => {
        const logs = [];
        incidents.forEach(inc => {
            // Creation log
            logs.push({
                id: `${inc.id}-created`,
                timestamp: inc.timestamp || 0,
                displayTime: inc.serverTime,
                message: (
                    <>
                        <strong>{inc.reportedBy}</strong> has created an Incident for <strong>{inc.agencyLabel || inc.agency}</strong>
                    </>
                ),
                icon: "fa-plus-circle",
                color: "text-success"
            });
            
            // Handling log
            if (inc.status === 'Handled' && inc.handledAt) {
                logs.push({
                    id: `${inc.id}-handled`,
                    timestamp: inc.handledAt,
                    displayTime: new Date(inc.handledAt).toLocaleString('en-GB'),
                    message: (
                        <>
                            Incident with <strong>{inc.agencyLabel || inc.agency}</strong> at <strong>{inc.dateTime || `${inc.date} ${inc.time}`}</strong> has been <strong>HANDLED</strong> by <strong>{inc.handledBy}</strong>
                        </>
                    ),
                    icon: "fa-check-double",
                    color: "text-info"
                });
            }
        });
        return logs.sort((a, b) => b.timestamp - a.timestamp);
    }, [incidents]);

    if (isLoading) return <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>;

    // Custom Div-based Overlay Styles
    const overlayStyle = {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 10000, backdropFilter: 'blur(10px)', padding: '20px'
    };

    const detailContainerStyle = {
        backgroundColor: '#0d1117', borderRadius: '12px', border: '1px solid #30363d',
        width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto',
        padding: '2rem', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)', position: 'relative'
    };

    return (
        <Card className="bg-dark text-light border-secondary">
            <Card.Header className="bg-dark border-secondary text-white d-flex justify-content-between align-items-center">
                <h5 className="mb-0"><i className="fas fa-shield-alt me-2 text-danger"></i>Agency Incident Logs</h5>
                <Badge bg="info">{incidents.length} Reports</Badge>
            </Card.Header>
            <Card.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                
                {incidents.length === 0 ? (
                    <div className="text-center py-5 text-info">
                        <i className="fas fa-clipboard-check fa-3x mb-3"></i>
                        <p>No agency incidents reported yet.</p>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <Table striped bordered hover variant="dark" size="sm" className="mb-0">
                            <thead>
                                <tr>
                                    <th>Incident Date/Time</th>
                                    <th>Agency</th>
                                    <th>Status</th>
                                    <th className="text-center">Details</th>
                                    <th className="text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {incidents.map((inc) => (
                                    <tr key={inc.id}>
                                        <td style={{ whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                            <small className="text-info">
                                                {inc.dateTime || `${inc.date} ${inc.time}`}
                                            </small>
                                        </td>
                                        <td style={{ verticalAlign: 'middle' }}>
                                            <strong>{inc.agencyLabel || inc.agency}</strong>
                                        </td>
                                        <td style={{ verticalAlign: 'middle' }}>
                                            <Badge bg={inc.status === 'Handled' ? 'success' : 'warning'} text={inc.status === 'Handled' ? 'white' : 'dark'}>
                                                {inc.status || 'Pending'}
                                            </Badge>
                                        </td>
                                        <td className="text-center">
                                            <Button 
                                                variant="outline-primary" 
                                                size="sm" 
                                                onClick={() => handleView(inc)}
                                            >
                                                <i className="fas fa-eye me-1"></i>View
                                            </Button>
                                        </td>
                                        <td className="text-center">
                                            <div className="d-flex gap-2 justify-content-center">
                                                {inc.status !== 'Handled' && (
                                                    <Button 
                                                        variant="success" 
                                                        size="sm" 
                                                        onClick={() => handleMarkAsHandled(inc.id)}
                                                        title="Mark as Handled"
                                                    >
                                                        <i className="fas fa-check"></i>
                                                    </Button>
                                                )}
                                                <Button 
                                                    variant="outline-danger" 
                                                    size="sm" 
                                                    onClick={() => handleDelete(inc.id, inc.agencyLabel)}
                                                >
                                                    <i className="fas fa-trash"></i>
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                )}
            </Card.Body>

            {/* Incident Activity Logs Panel */}
            <Card className="mt-4 bg-dark text-light border-secondary">
                <Card.Header className="bg-dark border-secondary text-white">
                    <h5 className="mb-0"><i className="fas fa-history me-2 text-info"></i>Agency Incident - Activity Logs</h5>
                </Card.Header>
                <Card.Body className="p-0">
                    <ListGroup variant="flush">
                        {activityLogs.length === 0 ? (
                            <ListGroup.Item className="bg-dark text-info text-center py-4 border-secondary">
                                No activity recorded.
                            </ListGroup.Item>
                        ) : (
                            activityLogs.map((log) => (
                                <ListGroup.Item key={log.id} className="bg-dark text-light border-secondary py-3">
                                    <div className="d-flex align-items-start">
                                        <div className={`me-3 mt-1 ${log.color}`}>
                                            <i className={`fas ${log.icon} fa-lg`}></i>
                                        </div>
                                        <div className="flex-grow-1">
                                            <div className="d-flex justify-content-between align-items-center mb-1">
                                                <small className="text-info" style={{ fontFamily: 'monospace' }}>
                                                    {log.displayTime}
                                                </small>
                                            </div>
                                            <div style={{ fontSize: '0.95rem' }}>
                                                {log.message}
                                            </div>
                                        </div>
                                    </div>
                                </ListGroup.Item>
                            ))
                        )}
                    </ListGroup>
                </Card.Body>
            </Card>

            {/* Custom Detail Div-Overlay (No Bootstrap Modal) */}
            {showDetail && selectedIncident && (
                <div style={overlayStyle} onClick={() => setShowDetail(false)}>
                    <div style={detailContainerStyle} onClick={e => e.stopPropagation()}>
                        <div className="d-flex justify-content-between align-items-center mb-4 border-bottom border-secondary pb-3">
                            <h2 style={{ color: '#fff', margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>
                                <i className="fas fa-file-alt text-info me-2"></i>
                                Incident: {selectedIncident.agencyLabel}
                            </h2>
                            <button onClick={() => setShowDetail(false)} style={{ background: 'none', border: 'none', color: '#8b949e', fontSize: '2rem', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
                        </div>

                        <div className="row mb-4">
                            <div className="col-md-6">
                                <h6 className="text-info text-uppercase small font-weight-bold">Incident Timing</h6>
                                <p className="mb-1"><strong>Incident:</strong> {selectedIncident.dateTime || `${selectedIncident.date} ${selectedIncident.time}`}</p>
                                <p className="mb-1"><small className="text-warning"><strong>Server Log (FR):</strong> {selectedIncident.serverTime}</small></p>
                                <p className="mb-0">
                                    <strong>Status:</strong>{' '}
                                    <Badge bg={selectedIncident.status === 'Handled' ? 'success' : 'warning'} text={selectedIncident.status === 'Handled' ? 'white' : 'dark'}>
                                        {selectedIncident.status || 'Pending'}
                                    </Badge>
                                </p>
                            </div>
                            <div className="col-md-6 text-md-end">
                                <h6 className="text-info text-uppercase small font-weight-bold">Reporter</h6>
                                <p className="mb-1"><strong>Name:</strong> {selectedIncident.reportedBy}</p>
                                <p className="mb-0"><strong>UID:</strong> {selectedIncident.reportedByUid}</p>
                            </div>
                        </div>

                        <div className="row mb-4">
                            <div className="col-12">
                                <h6 className="text-info text-uppercase small font-weight-bold mb-3">Report Log</h6>
                                <div className="p-3 rounded border border-secondary" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                                    <div className="d-flex align-items-center mb-2">
                                        <div className="rounded-circle bg-success me-3" style={{ width: '10px', height: '10px' }}></div>
                                        <div className="small">
                                            <strong>Reported:</strong> {selectedIncident.serverTime} by {selectedIncident.reportedBy}
                                        </div>
                                    </div>
                                    {selectedIncident.status === 'Handled' && (
                                        <div className="d-flex align-items-center">
                                            <div className="rounded-circle bg-info me-3" style={{ width: '10px', height: '10px' }}></div>
                                            <div className="small">
                                                <strong>Handled:</strong> {new Date(selectedIncident.handledAt).toLocaleString('en-GB')} by {selectedIncident.handledBy}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mb-4">
                            <h6 className="text-info text-uppercase small font-weight-bold mb-2">Description</h6>
                            <div className="p-3 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.05)', whiteSpace: 'pre-wrap', border: '1px solid #30363d' }}>
                                {selectedIncident.description || "No description provided."}
                            </div>
                        </div>

                        {selectedIncident.screenshotUrl && (
                            <div className="mb-4">
                                <h6 className="text-info text-uppercase small font-weight-bold mb-2">Evidence</h6>
                                <div className="text-center bg-black p-2 rounded border border-secondary">
                                    <img 
                                        src={selectedIncident.screenshotUrl} 
                                        alt="Incident Evidence" 
                                        style={{ maxWidth: '100%', maxHeight: '500px', cursor: 'pointer', borderRadius: '4px' }}
                                        onClick={() => window.open(selectedIncident.screenshotUrl, '_blank')}
                                    />
                                    <div className="mt-3">
                                        <Button variant="outline-info" size="sm" onClick={() => window.open(selectedIncident.screenshotUrl, '_blank')}>
                                            <i className="fas fa-external-link-alt me-1"></i>View Full Resolution
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="d-flex justify-content-between pt-3 border-top border-secondary">
                            <div>
                                <Button variant="danger" onClick={() => handleDelete(selectedIncident.id, selectedIncident.agencyLabel)}>
                                    <i className="fas fa-trash me-2"></i>Delete Record
                                </Button>
                            </div>
                            <div className="d-flex gap-2">
                                {selectedIncident.status !== 'Handled' && (
                                    <Button variant="success" onClick={() => handleMarkAsHandled(selectedIncident.id)}>
                                        <i className="fas fa-check me-2"></i>Mark as Handled
                                    </Button>
                                )}
                                <Button variant="secondary" onClick={() => setShowDetail(false)}>Close</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};

export default AgencyIncidentManager;
