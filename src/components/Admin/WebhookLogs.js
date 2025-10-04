import React, { useState, useEffect } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import { Card, Accordion, Button } from 'react-bootstrap';

const WebhookLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
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
            }
            setLoading(false);
        };
        fetchLogs();
    }, []);

    return (
        <Card>
            <Card.Header>Webhook Logs</Card.Header>
            <Card.Body style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {loading ? <p>Loading...</p> : (
                    <Accordion>
                        {logs.map((log, index) => (
                            <Accordion.Item key={log.id} eventKey={index.toString()}>
                                <Accordion.Header>
                                    <strong>{new Date(log.timestamp).toLocaleString()}</strong> - {log.type}
                                </Accordion.Header>
                                <Accordion.Body>
                                    <pre>{JSON.stringify(log.payload, null, 2)}</pre>
                                </Accordion.Body>
                            </Accordion.Item>
                        ))}
                    </Accordion>
                )}
            </Card.Body>
        </Card>
    );
};

export default WebhookLogs;
