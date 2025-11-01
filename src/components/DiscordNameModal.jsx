import React, { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

const DiscordNameModal = ({ show, handleClose, handleSave, currentDiscordName }) => {
    const [discordName, setDiscordName] = useState(currentDiscordName);

    useEffect(() => {
        setDiscordName(currentDiscordName);
    }, [currentDiscordName]);

    const onSave = () => {
        handleSave(discordName);
    };

    return (
        <Modal show={show} onHide={handleClose} centered>
            <Modal.Header closeButton>
                <Modal.Title>Edit Discord Name</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p>This is a very hacky solution - no bully.</p>
                <Form.Group>
                    <Form.Label>Discord Name</Form.Label>
                    <Form.Control
                        type="text"
                        value={discordName}
                        onChange={(e) => setDiscordName(e.target.value)}
                        placeholder="Enter your Discord name"
                    />
                </Form.Group>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>
                    Close
                </Button>
                <Button variant="primary" onClick={onSave}>
                    Save Changes
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default DiscordNameModal;