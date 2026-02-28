// src/components/Admin/CctvDashboard.jsx
import React, { useState, useMemo } from 'react';
import { Form, Card, ListGroup } from 'react-bootstrap';
import cctvLogs1 from '../cctv example/cctv-logs1.json';
import cctvLogs2 from '../cctv example/cctv-logs2.json';

const CctvDashboard = () => {
    const [searchQuery, setSearchQuery] = useState('');

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) {
            return null;
        }

        const query = searchQuery.toLowerCase();
        
        const results1 = cctvLogs1.data.filter(log => 
            log.message.toLowerCase().includes(query)
        );

        const results2 = cctvLogs2.data.filter(log => 
            log.message.toLowerCase().includes(query)
        );

        return {
            logs1: results1,
            logs2: results2,
        };
    }, [searchQuery]);

    const renderLogItem = (log) => (
        <ListGroup.Item key={log.id}>
            <div className="d-flex justify-content-between">
                <span dangerouslySetInnerHTML={{ __html: log.message }}></span>
                <small className="text-muted" dangerouslySetInnerHTML={{ __html: log.date }}></small>
            </div>
        </ListGroup.Item>
    );

    return (
        <Card>
            <Card.Header>
                <h5><i className="fas fa-video me-2"></i>CCTV Dashboard (Proof of Concept)</h5>
            </Card.Header>
            <Card.Body>
                <Form.Group className="mb-3">
                    <Form.Control
                        type="text"
                        placeholder="Search CCTV logs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </Form.Group>

                {searchResults && (
                    <div>
                        {searchResults.logs1.length > 0 && (
                            <Card className="mb-3">
                                <Card.Header className="bg-info text-white">Results from CCTV Logs 1</Card.Header>
                                <ListGroup variant="flush">
                                    {searchResults.logs1.map(renderLogItem)}
                                </ListGroup>
                            </Card>
                        )}

                        {searchResults.logs2.length > 0 && (
                            <Card>
                                <Card.Header className="bg-success text-white">Results from CCTV Logs 2</Card.Header>
                                <ListGroup variant="flush">
                                    {searchResults.logs2.map(renderLogItem)}
                                </ListGroup>
                            </Card>
                        )}

                        {searchResults.logs1.length === 0 && searchResults.logs2.length === 0 && (
                            <div className="text-center text-muted py-3">
                                <i className="fas fa-search fa-2x mb-2"></i>
                                <p>No results found for &quot;{searchQuery}&quot;.</p>
                            </div>
                        )}
                    </div>
                )}
            </Card.Body>
        </Card>
    );
};

export default CctvDashboard;