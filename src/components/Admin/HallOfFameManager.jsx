import React, { useState, useEffect, useCallback } from 'react';
import { Button, Table, Form, Modal, Spinner, Alert, Image } from 'react-bootstrap';
import { database } from '../../firebase';
import { ref, get, set, remove, update } from 'firebase/database';
import { useImageUpload } from '../../hooks/useImageUpload';

const HallOfFameManager = ({ showNotification }) => {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingEntry, setEditingEntry] = useState(null); // { id, name, description, imageUrl }
    const [error, setError] = useState(null);

    // Image Upload Hook
    // We pass a setter that adapts to what useImageUpload expects
    const { isUploading, handleImageUpload } = useImageUpload(
        (msg, type) => showNotification && showNotification(msg, type),
        (updater) => {
            setEditingEntry(prev => {
                const newState = updater(prev || {});
                return newState;
            });
        }
    );

    const fetchEntries = useCallback(async () => {
        setLoading(true);
        try {
            const dbRef = ref(database, 'hallOfFame');
            const snapshot = await get(dbRef);
            if (snapshot.exists()) {
                const data = snapshot.val();
                const entryList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                setEntries(entryList);
            } else {
                setEntries([]);
            }
        } catch (err) {
            console.error(err);
            setError('Failed to fetch Hall of Fame entries.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEntries();
    }, [fetchEntries]);

    const handleOpenModal = (entry = null) => {
        setEditingEntry(entry || { name: '', description: '', imageUrl: '' });
        setShowModal(true);
        setError(null);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingEntry(null);
    };

    const handleSave = async () => {
        if (!editingEntry.name || !editingEntry.imageUrl) {
            setError('Name and Image are required.');
            return;
        }

        setLoading(true);
        try {
            const id = editingEntry.id || `hof_${Date.now()}`;
            const dbRef = ref(database, `hallOfFame/${id}`);
            
            await set(dbRef, {
                name: editingEntry.name,
                description: editingEntry.description || '',
                imageUrl: editingEntry.imageUrl,
                updatedAt: Date.now()
            });

            handleCloseModal();
            fetchEntries();
            if (showNotification) showNotification('Hall of Fame entry saved!', 'success');
        } catch (err) {
            console.error(err);
            setError('Failed to save entry.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this entry?')) return;
        
        setLoading(true);
        try {
            const dbRef = ref(database, `hallOfFame/${id}`);
            await remove(dbRef);
            fetchEntries();
            if (showNotification) showNotification('Entry deleted.', 'success');
        } catch (err) {
            console.error(err);
            setError('Failed to delete entry.');
        } finally {
            setLoading(false);
        }
    };

    const onFileChange = async (e) => {
        if (e.target.files && e.target.files[0]) {
            // Field name 'imageUrl' matches the key in editingEntry we want to update
            await handleImageUpload(e.target.files[0], 'imageUrl'); 
        }
    };

    return (
        <div className="p-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h3>Hall of Fame Manager</h3>
                <Button variant="primary" onClick={() => handleOpenModal()}>
                    <i className="fas fa-plus me-2"></i> Add New Member
                </Button>
            </div>

            {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

            {loading && !showModal ? (
                <div className="text-center">
                    <Spinner animation="border" />
                </div>
            ) : (
                <Table striped bordered hover responsive variant="dark">
                    <thead>
                        <tr>
                            <th style={{width: '80px'}}>Image</th>
                            <th>Name</th>
                            <th>Description</th>
                            <th style={{width: '150px'}}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.length === 0 ? (
                            <tr><td colSpan="4" className="text-center">No entries found.</td></tr>
                        ) : (
                            entries.map(entry => (
                                <tr key={entry.id}>
                                    <td>
                                        <Image src={entry.imageUrl} roundedCircle style={{width: '50px', height: '50px', objectFit: 'cover'}} />
                                    </td>
                                    <td>{entry.name}</td>
                                    <td>{entry.description && entry.description.length > 50 ? entry.description.substring(0, 50) + '...' : entry.description}</td>
                                    <td>
                                        <Button variant="outline-info" size="sm" className="me-2" onClick={() => handleOpenModal(entry)}>
                                            <i className="fas fa-edit"></i>
                                        </Button>
                                        <Button variant="outline-danger" size="sm" onClick={() => handleDelete(entry.id)}>
                                            <i className="fas fa-trash"></i>
                                        </Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </Table>
            )}

            <Modal show={showModal} onHide={handleCloseModal} backdrop="static" centered>
                <Modal.Header closeButton className="bg-dark text-white">
                    <Modal.Title>{editingEntry?.id ? 'Edit Member' : 'Add Member'}</Modal.Title>
                </Modal.Header>
                <Modal.Body className="bg-dark text-white">
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Name</Form.Label>
                            <Form.Control 
                                type="text" 
                                value={editingEntry?.name || ''} 
                                onChange={(e) => setEditingEntry(prev => ({...prev, name: e.target.value}))}
                                className="bg-secondary text-white border-secondary"
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Description</Form.Label>
                            <Form.Control 
                                as="textarea" 
                                rows={3}
                                value={editingEntry?.description || ''} 
                                onChange={(e) => setEditingEntry(prev => ({...prev, description: e.target.value}))}
                                className="bg-secondary text-white border-secondary"
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Profile Picture</Form.Label>
                            <div className="d-flex align-items-center gap-3">
                                {editingEntry?.imageUrl && (
                                    <Image src={editingEntry.imageUrl} rounded style={{width: '80px', height: '80px', objectFit: 'cover'}} />
                                )}
                                <div className="flex-grow-1">
                                    <Form.Control 
                                        type="file" 
                                        onChange={onFileChange}
                                        disabled={isUploading}
                                        accept="image/*"
                                        className="bg-secondary text-white border-secondary"
                                    />
                                    {isUploading && <div className="text-info small mt-1"><Spinner size="sm" animation="border" className="me-1"/> Uploading...</div>}
                                    <Form.Text className="text-muted">
                                        Or paste URL directly:
                                    </Form.Text>
                                    <Form.Control 
                                        type="text" 
                                        placeholder="https://..."
                                        value={editingEntry?.imageUrl || ''}
                                        onChange={(e) => setEditingEntry(prev => ({...prev, imageUrl: e.target.value}))}
                                        className="bg-secondary text-white border-secondary mt-1"
                                    />
                                </div>
                            </div>
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer className="bg-dark border-secondary">
                    <Button variant="secondary" onClick={handleCloseModal}>Cancel</Button>
                    <Button variant="primary" onClick={handleSave} disabled={loading || isUploading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default HallOfFameManager;
