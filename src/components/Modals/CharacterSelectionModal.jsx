import React, { useState, useEffect } from 'react';
import './BaseModal.css'; // Common modal styles
import styles from './CharacterSelectionModal.module.css'; // Component-specific styles for buttons/radios

/**
 * Custom modal for selecting which PHMC character to use as employee when user has multiple characters
 */
const CharacterSelectionModal = ({ 
    show, 
    onHide, 
    characters, 
    onCharacterSelect, 
    currentSelection,
    title = "Select Character"
}) => {
    // Determine initial selectedCharacterId
    const [selectedCharacterId, setSelectedCharacterId] = useState(() => {
        if (currentSelection?.id) {
            return currentSelection.id;
        }
        if (characters && characters.length > 0) {
            // Ensure characters are valid before accessing .id
            const validCharacters = characters.filter(char => char && char.id !== undefined);
            if (validCharacters.length > 0) {
                return validCharacters[0].id;
            }
        }
        return null;
    });

    // Update selectedCharacterId if currentSelection prop changes
    useEffect(() => {
        if (currentSelection?.id) {
            setSelectedCharacterId(currentSelection.id);
        } else if (!selectedCharacterId && characters && characters.length > 0) {
            const validCharacters = characters.filter(char => char && char.id !== undefined);
            if (validCharacters.length > 0) {
                setSelectedCharacterId(validCharacters[0].id);
            }
        }
    }, [currentSelection, characters]); // Add characters to dependency array

    const handleConfirm = () => {
        const selectedCharacter = characters.find(char => char.id === selectedCharacterId);
        if (selectedCharacter) {
            onCharacterSelect(selectedCharacter);
        }
        onHide();
    };

    if (!show || !characters || characters.length === 0) {
        return null;
    }

    return (
        <div className="modal-overlay" onClick={onHide}>
            <div className="modal-container modal-size-medium" onClick={e => e.stopPropagation()}>
                <div className="modal-header" style={{ backgroundColor: '#1a1a1a', borderBottom: '1px solid #444' }}>
                    <h2 className="modal-title" style={{ color: '#e0e0e0' }}>
                        <i className="fas fa-users"></i> {title}
                    </h2>
                    <button className="modal-close-button" onClick={onHide}>
                        &times;
                    </button>
                </div>
                
                <div className="modal-content" style={{ backgroundColor: '#2a2a2a', color: '#e0e0e0' }}>
                    <p className="mb-3">
                        You have multiple PHMC characters. Please select which character to use as the employee name:
                    </p>
                    
                    <form onSubmit={(e) => { e.preventDefault(); handleConfirm(); }}>
                        {characters.map((character) => {
                            // Ensure character and character.id exist
                            if (!character || character.id === undefined) {
                                return null;
                            }
                            const characterName = character.characterName || `${character.firstname || ''} ${character.lastname || ''}`.trim();
                            const isSelected = character.id === selectedCharacterId;
                            
                            return (
                                <label 
                                    key={character.id} 
                                    className={styles.customRadioContainer}
                                >
                                    <input
                                        type="radio"
                                        name="character-selection"
                                        value={character.id}
                                        checked={isSelected}
                                        onChange={() => setSelectedCharacterId(character.id)}
                                    />
                                    <span className={styles.radioLabel}>
                                        <div className={styles.radioContent}>
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
                                                    <span className="badge bg-primary" style={{backgroundColor: '#0d6efd', color: '#fff', padding: '0.35em 0.65em', borderRadius: '0.25rem'}}>
                                                        Rank {character.scriptRank}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </span>
                                </label>
                            );
                        })}
                    </form>
                    
                    <div className="mt-3 p-2 rounded" style={{ backgroundColor: '#1a1a1a', border: '1px solid #444' }}>
                        <small className="text-muted">
                            <i className="fas fa-info-circle"></i> This selection will be used to auto-fill employee name fields in forms.
                            You can change this selection at any time.
                        </small>
                    </div>
                </div>
                
                <div className={styles.modalFooter} style={{ backgroundColor: '#1a1a1a', borderTop: '1px solid #444' }}>
                    <button type="button" className={styles.btnSecondary} onClick={onHide}>
                        Cancel
                    </button>
                    <button 
                        type="button" 
                        className={styles.btnPrimary} 
                        onClick={handleConfirm}
                        disabled={!selectedCharacterId}
                    >
                        <i className="fas fa-check"></i> Select Character
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CharacterSelectionModal;
