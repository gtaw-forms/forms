import React, { useState, useEffect } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import { Accordion, Button, Spinner } from 'react-bootstrap';

const WebhookLogs = ({ refreshTrigger, onRefresh }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const db = getDatabase();
            const logsRef = ref(db, 'webhook_logs');
            const snapshot = await get(logsRef);
            if (snapshot.exists()) {
                const logsData = snapshot.val();
                const logList = Object.keys(logsData).map(key => ({
                    id: key,
                    ...logsData[key]
                })).sort((a, b) => b.timestamp - a.timestamp);
                setLogs(logList);
            } else {
                setLogs([]);
            }
        } catch (error) {
            console.error('Error loading webhook logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [refreshTrigger]);

    const handleRefresh = () => {
        fetchLogs();
        if (onRefresh) onRefresh();
    };

    return (
        <>
            <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
                <h6 className="mb-0">
                    <i className="fas fa-history me-2"></i>
                    Webhook Activity Logs ({logs.length})
                </h6>
                <Button 
                    variant="outline-primary" 
                    size="sm"
                    onClick={handleRefresh}
                    disabled={loading}
                    title="Refresh webhook logs"
                >
                    {loading ? (
                        <Spinner as="span" animation="border" size="sm" />
                    ) : (
                        <i className="fas fa-sync-alt"></i>
                    )} Refresh
                </Button>
            </div>
            <div style={{ maxHeight: '500px', overflowY: 'auto' }} className="p-3">
                {loading && logs.length === 0 ? (
                    <div className="text-center text-muted py-4">
                        <Spinner animation="border" size="sm" className="me-2" />
                        Loading webhook logs...
                    </div>
                ) : logs.length > 0 ? (
                    <Accordion>
                        {logs.map((log, index) => (
                            <Accordion.Item key={log.id} eventKey={index.toString()}>
                                <Accordion.Header>
                                    <div className="d-flex justify-content-between align-items-center w-100 me-3">
                                        <span>
                                            <strong>{new Date(log.timestamp).toLocaleString()}</strong>
                                        </span>
                                        <span className={`badge ${log.type === 'dev' ? 'bg-warning' : log.type === 'coronerAlerts' ? 'bg-danger' : 'bg-primary'}`}>
                                            {log.type}
                                        </span>
                                    </div>
                                </Accordion.Header>
                                <Accordion.Body>
                                    <div className="row">
                                        <div className="col-md-6">
                                            <h6>Request Details</h6>
                                            <p><strong>Timestamp:</strong> {new Date(log.timestamp).toLocaleString()}</p>
                                            <p><strong>Type:</strong> {log.type}</p>
                                            {log.webhookUrl && (
                                                <p><strong>Webhook URL:</strong> <small className="text-muted">{log.webhookUrl}</small></p>
                                            )}
                                        </div>
                                        <div className="col-md-6">
                                            <h6>Payload</h6>
                                            <pre style={{ fontSize: '12px', maxHeight: '200px', overflow: 'auto' }}>
                                                {JSON.stringify(log.payload, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                </Accordion.Body>
                            </Accordion.Item>
                        ))}
                    </Accordion>
                ) : (
                    <div className="text-center text-muted py-4">
                        <i className="fas fa-inbox fa-2x mb-2"></i>
                        <p>No webhook activity yet. Webhook requests will appear here.</p>
                    </div>
                )}
            </div>
        </>
    );
};

export default WebhookLogs;
