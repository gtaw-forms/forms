import React, { useState } from 'react';
import { Button, Form, Spinner, Card, Alert } from 'react-bootstrap';
import { ref, get, set } from 'firebase/database';
import { database } from '../../firebase';

const DatabaseEditor = ({ showNotification }) => {
    const [path, setPath] = useState('/agencies');
    const [jsonData, setJsonData] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleFetch = async () => {
        if (!path) {
            showNotification('Please enter a database path.', 'warning');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const dbRef = ref(database, path);
            const snapshot = await get(dbRef);
            if (snapshot.exists()) {
                setJsonData(JSON.stringify(snapshot.val(), null, 2));
            } else {
                setJsonData('');
                showNotification('No data at this path.', 'info');
            }
        } catch (e) {
            setError(e.message);
            showNotification(`Error fetching data: ${e.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!path) {
            showNotification('Please enter a database path.', 'warning');
            return;
        }
        let dataToSave;
        try {
            dataToSave = JSON.parse(jsonData);
        } catch (e) {
            setError('Invalid JSON format.');
            showNotification('Invalid JSON format. Please correct it before saving.', 'error');
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const dbRef = ref(database, path);
            await set(dbRef, dataToSave);
            showNotification('Data saved successfully!', 'check-circle');
        } catch (e) {
            setError(e.message);
            showNotification(`Error saving data: ${e.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <Card.Header>Firebase Realtime Database Editor</Card.Header>
            <Card.Body>
                <Form.Group className="mb-3">
                    <Form.Label>Database Path</Form.Label>
                    <Form.Control
                        type="text"
                        value={path}
                        onChange={(e) => setPath(e.target.value)}
                        placeholder="e.g., /agencies/LSSD"
                    />
                </Form.Group>
                <Button onClick={handleFetch} disabled={isLoading} className="me-2">
                    {isLoading ? <Spinner as="span" animation="border" size="sm" /> : 'Fetch Data'}
                </Button>
                <hr />
                <Form.Group className="mb-3">
                    <Form.Label>JSON Data</Form.Label>
                    <Form.Control
                        as="textarea"
                        rows={20}
                        value={jsonData}
                        onChange={(e) => setJsonData(e.target.value)}
                        placeholder="JSON data will appear here..."
                    />
                </Form.Group>
                {error && <Alert variant="danger">{error}</Alert>}
                <Button onClick={handleSave} disabled={isLoading}>
                    {isLoading ? <Spinner as="span" animation="border" size="sm" /> : 'Save Data'}
                </Button>
            </Card.Body>
        </Card>
    );
};

export default DatabaseEditor;
