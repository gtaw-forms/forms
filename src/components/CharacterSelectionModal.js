import React, { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

/**
 * Modal for selecting which PHMC character to use as employee when user has multiple characters
 */
const CharacterSelectionModal = ({ 
    show, 
    onHide, 
    characters, 
    onCharacterSelect, 
    currentSelection,
    title = "Select Character"
}) => {
    const [selectedCharacterId, setSelectedCharacterId] = useState(
        currentSelection?.id || (characters && characters.length > 0 ? characters[0].id : null)
    );

    const handleConfirm = () => {
        const selectedCharacter = characters.find(char => char.id === parseInt(selectedCharacterId));
        if (selectedCharacter) {
            onCharacterSelect(selectedCharacter);
        }
        onHide();
    };

    if (!characters || characters.length === 0) {
        return null;
    }

    return (
        <Modal show={show} onHide={onHide} centered backdrop="static">
            <Modal.Header closeButton style={{ backgroundColor: '#1a1a1a', borderBottom: '1px solid #444' }}>
                <Modal.Title style={{ color: '#e0e0e0' }}>
                    <i className="fas fa-users"></i> {title}
                </Modal.Title>
            </Modal.Header>
            
            <Modal.Body style={{ backgroundColor: '#2a2a2a', color: '#e0e0e0' }}>
                <p className="mb-3">
                    You have multiple PHMC characters. Please select which character to use as the employee name:
                </p>
                
                <Form>
                    {characters.map((character, index) => {
                        const characterName = character.name || `${character.firstname || ''} ${character.lastname || ''}`.trim();
                        const isSelected = character.id === parseInt(selectedCharacterId);
                        
                        return (
                            <div key={character.id} className="mb-2">
                                <Form.Check
                                    type="radio"
                                    id={`character-${character.id}`}
                                    name="character-selection"
                                    label={
                                        <div className="d-flex justify-content-between align-items-center w-100">
                                            <div>
                                                <strong>{characterName}</strong>
                                                <br />
                                                <small className="text-muted">
                                                    Character ID: {character.id}
                                                </small>
                                            </div>
                                            {/* Show rank if available from faction data */}
                                            {character.scriptRank && (
                                                <div className="text-end">
                                                    <span className="badge bg-primary">
                                                        Rank {character.scriptRank}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    }
                                    checked={isSelected}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setSelectedCharacterId(character.id);
                                        }
                                    }}
                                    style={{ color: '#e0e0e0' }}
                                />
                            </div>
                        );
                    })}
                </Form>
                
                <div className="mt-3 p-2 rounded" style={{ backgroundColor: '#1a1a1a', border: '1px solid #444' }}>
                    <small className="text-muted">
                        <i className="fas fa-info-circle"></i> This selection will be used to auto-fill employee name fields in forms.
                        You can change this selection at any time.
                    </small>
                </div>
            </Modal.Body>
            
            <Modal.Footer style={{ backgroundColor: '#1a1a1a', borderTop: '1px solid #444' }}>
                <Button variant="secondary" onClick={onHide}>
                    Cancel
                </Button>
                <Button 
                    variant="primary" 
                    onClick={handleConfirm}
                    disabled={!selectedCharacterId}
                >
                    <i className="fas fa-check"></i> Select Character
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default CharacterSelectionModal;