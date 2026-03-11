import React, { useState, useEffect } from 'react';
import { database } from '../../firebase';
import { ref, onValue, remove, update, get } from 'firebase/database';
import { Spinner, Table, Button, Badge, Modal, Image, Alert } from 'react-bootstrap';
import { useNotification } from '../../contexts/NotificationContext';
import { useModal } from '../../contexts/ModalProvider';

const UnprocessedCKsViewer = ({ selectedForm, onPreload }) => {
    const [ckList, setCkList] = useState([]);
    const [loading, setLoading] = useState(true);
    const { showNotification, removeNotification } = useNotification();
    const { openImagePreview } = useModal();
    
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
            if (ckItem.reportPath) {
                const reportRef = ref(database, ckItem.reportPath);
                const snapshot = await get(reportRef);
                
                if (snapshot.exists()) {
                    if (ckItem.isMassFatality && ckItem.decedentIndex !== undefined) {
                        // Update specific decedent in Mass Fatality Report
                        // RTDB handles numeric keys in arrays as child paths
                        const decedentProcessedRef = ref(database, `${ckItem.reportPath}/data/decedents/${ckItem.decedentIndex}`);
                        await update(decedentProcessedRef, { processed: true });
                    } else {
                        // Standard Coroner Report
                        await update(reportRef, { processed: true });
                    }
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
                    const data = snapshot.val();
                    // Inject context for rendering Mass Fatality decedents
                    setViewData({
                        ...data,
                        isMassFatality: ckItem.isMassFatality,
                        decedentIndex: ckItem.decedentIndex
                    });
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
    
    const handlePreload = async (ckItem) => {
        if (!onPreload) {
            console.error("onPreload function not provided to UnprocessedCKsViewer");
            showNotification('Preload function is not available.', 'error');
            return;
        }
    
        const notificationId = showNotification('Preloading data...', 'spinner fa-spin', 0);
    
        try {
            if (ckItem.reportPath) {
                const reportRef = ref(database, ckItem.reportPath);
                const snapshot = await get(reportRef);
                if (snapshot.exists()) {
                    const reportData = snapshot.val();
                    
                    const isMF = ckItem.isMassFatality || (reportData.formId && reportData.formId.includes('mass'));
                    const displayData = isMF && reportData.data?.decedents
                        ? reportData.data.decedents[ckItem.decedentIndex || 0]
                        : reportData.data;
    
                    if (!displayData) {
                        showNotification('Decedent data could not be resolved for preloading.', 'warning');
                        removeNotification(notificationId);
                        return;
                    }
    
                    const date = new Date(displayData.pronouncedTimeOfDeath || reportData.data?.dateTime || ckItem.dateOfDeath);
                    const formattedDate = !isNaN(date.getTime()) ? date.toLocaleDateString() : '';
    
                    const decedentName = displayData.decedentName || '';
                    const isUnidentified = !decedentName || /unknown|john doe|jane doe/i.test(decedentName);

                    const valuesToPreload = {
                        deathRecordType: isUnidentified ? 'Unidentified' : 'Identified',
                        decedentName: decedentName,
                        decedentOOC: displayData.decedentOOC || '',
                        formattedDateOfDeath: formattedDate,
                        age: displayData.approximateAge || displayData.age || '',
                        sex: displayData.sex || '',
                        ethnicity: displayData.ethnicity || '',
                        placeOfDeath: displayData.location || displayData.placeOfDeath || '',
                        Manner: displayData.mannerOfDeath || '',
                        causeA: displayData.probableCauseOfDeath || '',


                    };
    
                    onPreload(valuesToPreload);
                    removeNotification(notificationId);
                    showNotification('Form preloaded with CK report data!', 'success');
    
                } else {
                    removeNotification(notificationId);
                    showNotification('Report data not found for preloading.', 'warning');
                }
            } else {
                removeNotification(notificationId);
                showNotification('Invalid report path for preloading.', 'error');
            }
        } catch (error) {
             console.error("Error preloading report details:", error);
             removeNotification(notificationId);
             showNotification('Failed to preload report details.', 'error');
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
                            <Image 
                                src={url} 
                                thumbnail 
                                style={{ maxWidth: '150px', maxHeight: '150px', objectFit: 'cover', background: '#0f172a', cursor: 'pointer' }} 
                                onClick={() => openImagePreview(url, imgArray, idx)}
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const formatDateSafe = (dateInput) => {
        if (!dateInput) return 'N/A';
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) {
            // If parsing fails, return the original string if it's a string, as it might be descriptive text.
            return typeof dateInput === 'string' ? dateInput : 'Invalid Date';
        }
        return date.toLocaleDateString();
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
                The following Coroner Reports &amp; Mass Fatality Reports are marked as Character Kills (CK) and require processing. Click &quot;Process&quot; to confirm the Death Record has been filed and remove them from this queue.
            </p>

            {loading ? (
                <div className="text-center p-4">
                    <Spinner animation="border" variant="light" />
                </div>
            ) : ckList.length === 0 ? (
                <div className="text-center p-4" style={{ border: '2px dashed #475569', borderRadius: '8px' }}>
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
                                        {formatDateSafe(item.dateOfDeath)}
                                    </td>
                                    <td className="fw-bold text-white">{item.decedentName}</td>
                                    <td>{item.decedentOOC}</td>
                                    <td className="text-end">
                                        <Button
                                            variant="outline-primary"
                                            size="sm"
                                            className="me-2"
                                            onClick={() => handlePreload(item)}
                                        >
                                            <i className="fas fa-download me-1"></i> Preload
                                        </Button>
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
                                    {/* Unified display logic for both Standard and Mass Fatality reports */}
                                    {(() => {
                                        const isMF = viewData.isMassFatality || (viewData.formId && viewData.formId.includes('mass'));
                                        const displayData = isMF && viewData.data?.decedents
                                            ? viewData.data.decedents[viewData.decedentIndex || 0]
                                            : viewData.data;
                                        
                                        if (!displayData) return <Alert variant="warning">Decedent data could not be resolved.</Alert>;

                                        return (
                                            <>
                                                {/* Key Info Header */}
                                                <div className="d-flex justify-content-between align-items-center mb-4 p-3 rounded" style={{ background: '#0f172a', border: '1px solid #334155' }}>
                                                    <div>
                                                        <h5 className="mb-1 text-white">{displayData.decedentName || 'Unknown'}</h5>
                                                        <div className="mb-1 text-white">(( {displayData.decedentOOC || 'N/A'} ))</div>
                                                        {isMF && <Badge bg="info" className="mt-1">Part of Mass Fatality Report</Badge>}
                                                    </div>
                                                    <div className="text-end">
                                                        <Badge bg={displayData.typeOfDeath === 'CK' ? 'danger' : 'secondary'}>
                                                            {displayData.typeOfDeath || 'Unknown Type'}
                                                        </Badge>
                                                        <div className="mb-1 text-white ms-2 mt-1">
                                                            {(() => {
                                                                const primaryDate = new Date(displayData.pronouncedTimeOfDeath);
                                                                const fallbackDate = new Date(viewData.data?.dateTime);

                                                                if (!isNaN(primaryDate.getTime())) {
                                                                    return primaryDate.toLocaleString();
                                                                }
                                                                if (!isNaN(fallbackDate.getTime())) {
                                                                    return fallbackDate.toLocaleString();
                                                                }
                                                                // Show the original text if it's a non-parsable string like "Afternoon"
                                                                if (typeof displayData.pronouncedTimeOfDeath === 'string') {
                                                                    return displayData.pronouncedTimeOfDeath;
                                                                }
                                                                return 'N/A';
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="row g-3 mb-4">
                                                    <div className="col-md-6">
                                                        <div className="p-3 rounded h-100" style={{ background: '#1e293b', border: '1px solid #475569' }}>
                                                            <label className="text-info small fw-bold text-uppercase d-block mb-1">Cause of Death</label>
                                                            <div>{displayData.probableCauseOfDeath || 'Not specified'}</div>
                                                        </div>
                                                    </div>
                                                    <div className="col-md-6">
                                                        <div className="p-3 rounded h-100" style={{ background: '#1e293b', border: '1px solid #475569' }}>
                                                            <label className="text-info small fw-bold text-uppercase d-block mb-1">Manner of Death</label>
                                                            <div>{displayData.mannerOfDeath || 'Not specified'}</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mb-4">
                                                    <h6 style={{color: '#a78bfa', borderBottom: '1px solid #475569', paddingBottom: '0.5rem'}}>Synopsis / Injuries</h6>
                                                    <div className="p-3 rounded" style={{ background: '#0f172a', border: '1px solid #334155', whiteSpace: 'pre-wrap', color: '#cbd5e1' }}>
                                                        {displayData.synopsis || 'No synopsis provided.'}
                                                    </div>
                                                </div>

                                                {/* Images Section - Supporting multiple possible field names across versions */}
                                                {renderImages(displayData.scenePhotos || displayData.scenePhotosBBCode || displayData.scene_photos_bbcode, "Scene Photos")}
                                                {renderImages(displayData.autopsyDiagram || displayData.autopsy_diagram, "Autopsy Diagram")}
                                                {renderImages(displayData.additionalImages || displayData.additionalPhotos || displayData.additional_photos, "Additional Photos")}
                                            </>
                                        );
                                    })()}
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
