import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Modal, Button, Row, Col, Card, Image, Spinner } from 'react-bootstrap';
import { database } from '../../firebase';
import { ref, get } from 'firebase/database';

const HallOfFameModal = ({ show, onHide }) => {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState(null);

    useEffect(() => {
        if (show) {
            setLoading(true);
            const dbRef = ref(database, 'hallOfFame');
            get(dbRef).then((snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                    setEntries(list);
                } else {
                    setEntries([]);
                }
            }).catch(console.error)
            .finally(() => setLoading(false));
        } else {
            setSelectedEntry(null); // Reset selection on close
        }
    }, [show]);

    if (!show) return null;

    return ReactDOM.createPortal(
        <div className="modal-overlay" onClick={onHide} style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1050
        }}>
            <div className="modal-content bg-dark text-white" onClick={e => e.stopPropagation()} style={{
                width: '90%',
                maxWidth: '1000px',
                maxHeight: '90vh',
                borderRadius: '15px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid #444',
                boxShadow: '0 0 20px rgba(0,0,0,0.5)'
            }}>
                <div className="modal-header border-secondary p-3 d-flex justify-content-between align-items-center bg-gradient" style={{ background: 'linear-gradient(90deg, #1a1a1a 0%, #2c3e50 100%)' }}>
                    <h3 className="m-0 text-warning"><i className="fas fa-trophy me-2"></i> PHMC Hall of Fame</h3>
                    <button className="btn-close btn-close-white" onClick={onHide}></button>
                </div>

                <div className="modal-body p-4" style={{ overflowY: 'auto' }}>
                    {loading ? (
                        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
                            <Spinner animation="border" variant="warning" />
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="text-center text-muted py-5">
                            <h4>The Hall is quiet... for now.</h4>
                        </div>
                    ) : (
                        <Row xs={1} md={2} lg={3} className="g-4">
                            {entries.map(entry => (
                                <Col key={entry.id}>
                                    <Card 
                                        className={`h-100 bg-secondary text-white border-0 shadow-sm ${selectedEntry?.id === entry.id ? 'ring-2 ring-warning' : ''}`}
                                        style={{ 
                                            cursor: 'pointer', 
                                            transition: 'transform 0.2s',
                                            transform: selectedEntry?.id === entry.id ? 'scale(1.02)' : 'scale(1)',
                                            outline: selectedEntry?.id === entry.id ? '2px solid #ffc107' : 'none'
                                        }}
                                        onClick={() => setSelectedEntry(selectedEntry?.id === entry.id ? null : entry)}
                                    >
                                        <div style={{ height: '250px', overflow: 'hidden', position: 'relative' }}>
                                            <Card.Img 
                                                variant="top" 
                                                src={entry.imageUrl} 
                                                style={{ 
                                                    height: '100%', 
                                                    width: '100%', 
                                                    objectFit: 'cover',
                                                    filter: selectedEntry?.id === entry.id ? 'brightness(1.1)' : 'brightness(0.9)'
                                                }} 
                                            />
                                            <div style={{
                                                position: 'absolute',
                                                bottom: 0,
                                                left: 0,
                                                right: 0,
                                                background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
                                                padding: '20px 10px 10px 10px'
                                            }}>
                                                <Card.Title className="text-center mb-0" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{entry.name}</Card.Title>
                                            </div>
                                        </div>
                                        
                                        {/* Description Box (Expandable) */}
                                        {selectedEntry?.id === entry.id && (
                                            <Card.Body className="bg-dark border-top border-secondary animate__animated animate__fadeIn">
                                                <Card.Text style={{ fontSize: '0.95rem', color: '#ddd', whiteSpace: 'pre-wrap' }}>
                                                    {entry.description || "No description available."}
                                                </Card.Text>
                                            </Card.Body>
                                        )}
                                    </Card>
                                </Col>
                            ))}
                        </Row>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default HallOfFameModal;
