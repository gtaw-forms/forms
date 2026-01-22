import React, { useState, useEffect } from 'react';
import { database } from '../../firebase';
import { ref, onValue, remove, update, get } from 'firebase/database';
import { Spinner, Table, Button, Badge, Modal, Image, Alert } from 'react-bootstrap';
import { useNotification } from '../../contexts/NotificationContext';

const UnprocessedCKsViewer = ({ selectedForm }) => {
    const [ckList, setCkList] = useState([]);
    const [loading, setLoading] = useState(true);
    const { showNotification } = useNotification();
    
    // View Modal State
    const [showViewModal, setShowViewModal] = useState(false);
    const [viewData, setViewData] = useState(null);
    const [loadingView, setLoadingView] = useState(false);

    useEffect(() => {
        // Only active for Death Record form
        // Checking multiple possible keys/names to ensure robustness against legacy/migration inconsistencies
        if (selectedForm?.firebaseKey !== 'death-record' && 
            selectedForm?.firebaseKey !== 'death_record' && 
            selectedForm?.name !== 'Death Record') {
            return;
        }

        const cksRef = ref(database, 'unprocessedCKs');
        const unsubscribe = onValue(cksRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list = Object.entries(data).map(([key, val]) => ({
                    id: key,
                    ...val
                }));
                // Sort by timestamp descending
                list.sort((a, b) => b.timestamp - a.timestamp);
                setCkList(list);
            } else {
                setCkList([]);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching unprocessed CKs:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [selectedForm]);

    const handleProcess = async (ckItem) => {
        if (!window.confirm(`Are you sure you want to mark the CK for ${ckItem.decedentName} as PROCESSED? This will remove it from the list.`)) {
            return;
        }

        try {
            // 1. Update the original report to set processed = true
            // We need to construct the path. ckItem.reportPath should be available.
            if (ckItem.reportPath) {
                const reportRef = ref(database, ckItem.reportPath);
                // Check if report exists first to avoid creating a partial node if it was deleted
                const snapshot = await get(reportRef);
                if (snapshot.exists()) {
                    await update(reportRef, { processed: true });
                } else {
                    console.warn("Original report not found, but removing from CK list.");
                }
            }

            // 2. Remove from unprocessedCKs list
            const ckListRef = ref(database, `unprocessedCKs/${ckItem.id}`);
            await remove(ckListRef);

            showNotification('CK Report marked as processed!', 'success');
        } catch (error) {
            console.error("Error processing CK:", error);
            showNotification('Failed to process CK report.', 'error');
        }
    };

    const handleView = async (ckItem) => {
        setLoadingView(true);
        setShowViewModal(true);
        setViewData(null); // Reset previous data

        try {
            if (ckItem.reportPath) {
                const reportRef = ref(database, ckItem.reportPath);
                const snapshot = await get(reportRef);
                if (snapshot.exists()) {
                    setViewData(snapshot.val());
                } else {
                    showNotification('Report data not found.', 'warning');
                    setShowViewModal(false);
                }
            } else {
                 showNotification('Invalid report path.', 'error');
                 setShowViewModal(false);
            }
        } catch (error) {
             console.error("Error fetching report details:", error);
             showNotification('Failed to load report details.', 'error');
             setShowViewModal(false);
        } finally {
            setLoadingView(false);
        }
    };

    const isDeathRecordForm = selectedForm?.firebaseKey === 'death-record' || 
                              selectedForm?.firebaseKey === 'death_record' || 
                              selectedForm?.name === 'Death Record';

    if (!isDeathRecordForm) {
        return null;
    }

    // Helper to render images safely
    const renderImages = (images, title) => {
        if (!images) return null;
        
        // Normalize to array
        const imgArray = Array.isArray(images) ? images : (typeof images === 'string' ? images.split(',').map(s=>s.trim()).filter(Boolean) : [images]);
        
        if (imgArray.length === 0) return null;

        return (
            <div className="mb-4">
                <h6 style={{color: '#a78bfa', borderBottom: '1px solid #475569', paddingBottom: '0.5rem'}}>{title}</h6>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {imgArray.map((url, idx) => (
                        <div key={idx} style={{ position: 'relative' }}>
                             <a href={url} target="_blank" rel="noopener noreferrer">
                                <Image 
                                    src={url} 
                                    thumbnail 
                                    style={{ maxWidth: '150px', maxHeight: '150px', objectFit: 'cover', background: '#0f172a' }} 
                                />
                             </a>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div style={{ 
            background: '#1e293b', 
            padding: '1.5rem', 
            borderRadius: '12px', 
            marginBottom: '2rem', 
            border: '1px solid #334155' 
        }}>
            <h4 style={{ color: '#f87171', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fas fa-skull-crossbones"></i> Unprocessed CK Reports
                <Badge bg="danger" pill>{ckList.length}</Badge>
            </h4>
            
            <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                The following Coroner Reports are marked as Character Kills (CK) and require processing. 
                Click "Process" to confirm the Death Record has been filed and remove them from this queue.
            </p>

            {loading ? (
                <div className="text-center p-4">
                    <Spinner animation="border" variant="light" />
                </div>
            ) : ckList.length === 0 ? (
                <div className="text-center p-4 text-muted" style={{ border: '2px dashed #475569', borderRadius: '8px' }}>
                    <i className="fas fa-check-circle fa-2x mb-2 text-success"></i>
                    <p>All CKs have been processed.</p>
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <Table hover variant="dark" responsive className="mb-0" style={{ fontSize: '0.9rem' }}>
                        <thead>
                            <tr>
                                <th>Date of Death</th>
                                <th>Decedent Name</th>
                                <th>OOC Name</th>
                                <th className="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ckList.map((item) => (
                                <tr key={item.id}>
                                    <td>
                                        {new Date(item.dateOfDeath).toLocaleDateString()}
                                    </td>
                                    <td className="fw-bold text-white">{item.decedentName}</td>
                                    <td>{item.decedentOOC}</td>
                                    <td className="text-end">
                                        <Button 
                                            variant="outline-info" 
                                            size="sm"
                                            className="me-2"
                                            onClick={() => handleView(item)}
                                        >
                                            <i className="fas fa-eye me-1"></i> View
                                        </Button>
                                        <Button 
                                            variant="outline-success" 
                                            size="sm"
                                            onClick={() => handleProcess(item)}
                                        >
                                            <i className="fas fa-check me-1"></i> Process
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            )}

            {/* Custom Overlay View Modal */}
            {showViewModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    zIndex: 1050, // High z-index to sit on top
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(5px)'
                }} onClick={() => setShowViewModal(false)}>
                    <div style={{
                        backgroundColor: '#1e293b',
                        borderRadius: '12px',
                        width: '90%',
                        maxWidth: '800px',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        border: '1px solid #475569',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    }} onClick={(e) => e.stopPropagation()}>
                        
                        {/* Header */}
                        <div style={{
                            padding: '1.5rem',
                            borderBottom: '1px solid #334155',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: '#0f172a',
                            borderTopLeftRadius: '12px',
                            borderTopRightRadius: '12px'
                        }}>
                            <h5 style={{ margin: 0, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <i className="fas fa-file-medical-alt text-info"></i>
                                CK Report Details
                            </h5>
                            <button 
                                onClick={() => setShowViewModal(false)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#cbd5e1',
                                    fontSize: '1.5rem',
                                    cursor: 'pointer',
                                    padding: '0 5px',
                                    lineHeight: 1
                                }}
                            >
                                &times;
                            </button>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
                            {loadingView ? (
                                <div className="text-center p-5">
                                    <Spinner animation="border" variant="info" />
                                    <p className="mt-2 text-muted">Loading report details...</p>
                                </div>
                            ) : viewData ? (
                                <div>
                                    {/* Key Info Header */}
                                    <div className="d-flex justify-content-between align-items-center mb-4 p-3 rounded" style={{ background: '#0f172a', border: '1px solid #334155' }}>
                                        <div>
                                            <h5 className="mb-1 text-white">{viewData.data?.decedentName}</h5>
                                            <div className="mb-1 text-white">(( {viewData.data?.decedentOOC} ))</div>
                                        </div>
                                        <div className="text-end">
                                            <Badge bg={viewData.data?.typeOfDeath === 'CK' ? 'danger' : 'secondary'}>
                                                {viewData.data?.typeOfDeath || 'Unknown Type'}
                                            </Badge>
                                            <div className="mb-1 text-white ms-2">
                                                {viewData.data?.dateTime ? new Date(viewData.data.dateTime).toLocaleString() : 'N/A'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="row g-3 mb-4">
                                        <div className="col-md-6">
                                            <div className="p-3 rounded h-100" style={{ background: '#1e293b', border: '1px solid #475569' }}>
                                                <label className="text-info small fw-bold text-uppercase d-block mb-1">Cause of Death</label>
                                                <div>{viewData.data?.probableCauseOfDeath || 'Not specified'}</div>
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <div className="p-3 rounded h-100" style={{ background: '#1e293b', border: '1px solid #475569' }}>
                                                <label className="text-info small fw-bold text-uppercase d-block mb-1">Manner of Death</label>
                                                <div>{viewData.data?.mannerOfDeath || 'Not specified'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <h6 style={{color: '#a78bfa', borderBottom: '1px solid #475569', paddingBottom: '0.5rem'}}>Synopsis</h6>
                                        <div className="p-3 rounded" style={{ background: '#0f172a', border: '1px solid #334155', whiteSpace: 'pre-wrap', color: '#cbd5e1' }}>
                                            {viewData.data?.synopsis || 'No synopsis provided.'}
                                        </div>
                                    </div>

                                    {/* Images Section */}
                                    {renderImages(viewData.data?.scenePhotosBBCode || viewData.data?.scene_photos_bbcode, "Scene Photos")}
                                    {renderImages(viewData.data?.autopsyDiagram || viewData.data?.autopsy_diagram, "Autopsy Diagram")}
                                    {renderImages(viewData.data?.additionalPhotos || viewData.data?.additional_photos, "Additional Photos")}
                                </div>
                            ) : (
                                <Alert variant="warning">No data available for this report.</Alert>
                            )}
                        </div>

                        {/* Footer */}
                        <div style={{
                            padding: '1rem 1.5rem',
                            borderTop: '1px solid #334155',
                            backgroundColor: '#0f172a',
                            borderBottomLeftRadius: '12px',
                            borderBottomRightRadius: '12px',
                            display: 'flex',
                            justifyContent: 'flex-end'
                        }}>
                            <Button variant="secondary" onClick={() => setShowViewModal(false)}>Close</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UnprocessedCKsViewer;
