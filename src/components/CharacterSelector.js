import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const CharacterSelector = ({ onCharacterSelect, selectedCharacterId, label = "Select Character", forceDropdown = false }) => {
    const { user: authUser } = useAuth();
    const [user, setUser] = useState(null);
    const [characters, setCharacters] = useState([]);
    const [selectedCharacter, setSelectedCharacter] = useState(null);
    const [useSessionStorage, setUseSessionStorage] = useState(false);

    useEffect(() => {
        // Check if sessionStorage data is available
        const fallbackUserRaw = sessionStorage.getItem('user');
        const hasSessionData = fallbackUserRaw && fallbackUserRaw !== 'null';
        
        if (hasSessionData && !useSessionStorage) {
            // Auto-enable sessionStorage if data is available and auth user is not
            if (!authUser || !authUser.userData) {
                setUseSessionStorage(true);
            }
        }
        
        // Set user data based on preference
        if (useSessionStorage && hasSessionData) {
            try {
                const fallbackUser = JSON.parse(fallbackUserRaw);
                setUser({ userData: fallbackUser });
            } catch (e) {
                setUser(null);
            }
        } else if (authUser && authUser.userData) {
            setUser(authUser);
        } else {
            setUser(null);
        }
    }, [authUser, useSessionStorage]);

    useEffect(() => {
        
        if (user && user.userData) {
            const characterArray = user.userData.character || user.userData.characters || [];
            
            if (Array.isArray(characterArray) && characterArray.length > 0) {
                // Filter out null/undefined/invalid entries
                const filteredCharacters = characterArray.filter(
                    char => char && typeof char.id !== 'undefined' && char.firstname && char.lastname
                );
                
                
                if (filteredCharacters.length === 0) {
                    console.warn('[CharacterSelector] No valid characters found after filtering:', characterArray);
                    setCharacters([]);
                    return;
                }
                
                const formattedCharacters = filteredCharacters.map(char => ({
                    id: char.id,
                    firstname: char.firstname || '',
                    lastname: char.lastname || '',
                    fullName: `${char.firstname || ''} ${char.lastname || ''}`.trim(),
                    memberid: char.memberid
                }));
                
                setCharacters(formattedCharacters);
                
                if (!selectedCharacterId && formattedCharacters.length > 0) {
                    const firstChar = formattedCharacters[0];
                    setSelectedCharacter(firstChar);
                    if (onCharacterSelect) {
                        onCharacterSelect(firstChar);
                    }
                } else if (selectedCharacterId) {
                    const character = formattedCharacters.find(char => char.id === selectedCharacterId);
                    if (character) {
                        setSelectedCharacter(character);
                    }
                }
            } else {
                setCharacters([]);
            }
        } else {
            setCharacters([]);
        }
    }, [user, selectedCharacterId]); // Removed onCharacterSelect from dependencies to prevent infinite loops

    const handleCharacterChange = (event) => {
        const characterId = parseInt(event.target.value);
        const character = characters.find(char => char.id === characterId);
        
        if (character) {
            setSelectedCharacter(character);
            onCharacterSelect && onCharacterSelect(character);
        }
    };

    const sessionUserRaw = sessionStorage.getItem('user');
    const hasSessionData = sessionUserRaw && sessionUserRaw !== 'null';
    
    const handleSessionToggle = () => {
        if (!useSessionStorage && hasSessionData) {
            setUseSessionStorage(true);
        } else {
            setUseSessionStorage(false);
        }
    };

    // For civilian forms, always show dropdown
    if (forceDropdown) {
        return (
            <div className="character-selector">
                <label htmlFor="character-select" style={{ marginBottom: '0.5rem', display: 'block' }}>{label}</label>
                {(!characters || characters.length === 0) ? (
                    <select disabled style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        fontSize: '14px'
                    }}>
                        <option>No characters available</option>
                    </select>
                ) : (
                    <select 
                        id="character-select"
                        value={selectedCharacter?.id || ''} 
                        onChange={handleCharacterChange}
                        style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '14px'
                        }}
                    >
                        <option value="">Select a character...</option>
                        {characters.map(character => (
                            <option key={character.id} value={character.id}>
                                {character.fullName} (ID: {character.id})
                            </option>
                        ))}
                    </select>
                )}
            </div>
        );
    }

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                <label style={{ marginBottom: 0 }}>{label}</label>
                {hasSessionData && (
                    <button
                        type="button"
                        onClick={handleSessionToggle}
                        className="close-button"
                        style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.8rem',
                            lineHeight: '1.2',
                            backgroundColor: useSessionStorage ? '#28a745' : '#007bff',
                            color: 'white',
                            border: 'none'
                        }}
                        title={useSessionStorage ? 'Using Session Data' : 'Use Session Data'}
                    >
                        <i className={`fas ${useSessionStorage ? 'fa-check' : 'fa-user'}`} style={{ marginRight: '5px' }}></i>
                        {useSessionStorage ? 'Using Session' : 'Use Session'}
                    </button>
                )}
            </div>
            
            {useSessionStorage && hasSessionData ? (
                <div style={{ 
                    padding: '10px', 
                    backgroundColor: '#1a2332', 
                    border: '1px solid #28a745', 
                    borderRadius: '4px',
                    marginBottom: '1rem'
                }}>
                    <div style={{ color: '#28a745', fontWeight: 'bold', marginBottom: '5px' }}>
                        <i className="fas fa-user-check" style={{ marginRight: '8px' }}></i>
                        Using Session Storage Data
                    </div>
                    <div style={{ color: '#eeeeeeb0' }}>
                        {selectedCharacter && (
                            <>
                                <strong>Selected:</strong> {selectedCharacter.fullName}<br/>
                            </>
                        )}
                        <small style={{ color: '#6c757d' }}>Click "Use Session" again to switch back to dropdown selection</small>
                    </div>
                </div>
            ) : (
                <div className="character-selector">
                    {(!characters || characters.length === 0) ? (
                        <select disabled style={{
                            width: '100%',
                            padding: '8px',
                            marginTop: '4px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '14px'
                        }}>
                            <option>No characters available</option>
                        </select>
                    ) : (
                        <select 
                            id="character-select"
                            value={selectedCharacter?.id || ''} 
                            onChange={handleCharacterChange}
                            style={{
                                width: '100%',
                                padding: '8px',
                                marginTop: '4px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                fontSize: '14px'
                            }}
                        >
                            <option value="">Select a character...</option>
                            {characters.map(character => (
                                <option key={character.id} value={character.id}>
                                    {character.fullName} (ID: {character.id})
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            )}
        </>
    );
};

export default CharacterSelector;