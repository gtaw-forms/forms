import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';

const CharacterSelector = ({ onCharacterSelect, selectedCharacterId, label = "Select Character", forceDropdown = false }) => {
    const { user: authUser } = useAuth();
    const { user: gtawUser, isAuthenticated: isGtawAuthenticated } = useGtaWorldAuth();
    const [user, setUser] = useState(null);
    const [characters, setCharacters] = useState([]);
    const [selectedCharacter, setSelectedCharacter] = useState(null);

    useEffect(() => {
        // Priority: 1. GTAW user (most current) 2. Firebase auth user
        if (isGtawAuthenticated && gtawUser) {
            setUser(gtawUser);
        } else if (authUser && authUser.userData) {
            setUser(authUser);
        } else {
            setUser(null);
        }
    }, [authUser, gtawUser, isGtawAuthenticated]);

    useEffect(() => {
        // Handle GTAW user data - check both direct characters and userData
        if (isGtawAuthenticated && gtawUser && (gtawUser.characters || gtawUser.character)) {
            // Search for characters in all possible locations
            let characterArray = [];
            
            // Check all possible character locations
            const possibleCharacterPaths = [
                { path: 'characters', value: gtawUser.characters },
                { path: 'userData.character', value: gtawUser.userData?.character },
                { path: 'userData.characters', value: gtawUser.userData?.characters },
                { path: 'character', value: gtawUser.character },
                { path: 'faction.characters', value: gtawUser.faction?.characters },
                { path: 'data.characters', value: gtawUser.data?.characters },
                { path: 'user.characters', value: gtawUser.user?.characters }
            ];
            
            // Find the first valid character array
            for (const pathData of possibleCharacterPaths) {
                if (Array.isArray(pathData.value) && pathData.value.length > 0) {
                    characterArray = pathData.value;
                    break;
                }
            }
            
            if (Array.isArray(characterArray) && characterArray.length > 0) {
                // Handle both formats: {id, name} and {id, firstname, lastname}
                const filteredCharacters = characterArray.filter(char => {
                    if (!char || typeof char.id === 'undefined') return false;
                    
                    // Check for new format (id + name)
                    if (char.name && typeof char.name === 'string') return true;
                    
                    // Check for old format (firstname + lastname)
                    if (char.firstname && char.lastname) return true;
                    
                    return false;
                });
                
                if (filteredCharacters.length === 0) {
                    setCharacters([]);
                    return;
                }
                
                const formattedCharacters = filteredCharacters.map(char => {
                    let fullName, firstname, lastname;
                    
                    if (char.name) {
                        // New format: use name directly
                        fullName = char.name;
                        const nameParts = char.name.split(' ');
                        firstname = nameParts[0] || '';
                        lastname = nameParts.slice(1).join(' ') || '';
                    } else {
                        // Old format: use firstname + lastname
                        firstname = char.firstname || '';
                        lastname = char.lastname || '';
                        fullName = `${firstname} ${lastname}`.trim();
                    }
                    
                    return {
                        id: char.id,
                        firstname,
                        lastname,
                        fullName,
                        memberid: char.memberid
                    };
                });
                
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
                return; // Exit early since we processed GTAW characters
            } else {
                setCharacters([]);
                return; // Exit early, don't try fallback for GTAW users
            }
        } 
        
        // Fallback to session storage or Firebase auth user (only if not GTAW authenticated)
        if (!isGtawAuthenticated && user && user.userData) {
            // Fallback to session storage or Firebase auth user (only if not GTAW authenticated)
            const characterArray = user.userData.character || user.userData.characters || [];
            
            if (Array.isArray(characterArray) && characterArray.length > 0) {
                // Filter out null/undefined/invalid entries - old format
                const filteredCharacters = characterArray.filter(
                    char => char && typeof char.id !== 'undefined' && char.firstname && char.lastname
                );
                
                if (filteredCharacters.length === 0) {
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
        } else if (!isGtawAuthenticated) {
            setCharacters([]);
        } else {
            setCharacters([]);
        }
    }, [user, selectedCharacterId, gtawUser, isGtawAuthenticated]); // Removed onCharacterSelect from dependencies to prevent infinite loops

    const handleCharacterChange = (event) => {
        const characterId = parseInt(event.target.value);
        const character = characters.find(char => char.id === characterId);
        
        if (character) {
            setSelectedCharacter(character);
            onCharacterSelect && onCharacterSelect(character);
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
                        <option>
                            {isGtawAuthenticated ? 'No characters found' : 'Login with GTAW to see your characters'}
                        </option>
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
                    <option>
                        {isGtawAuthenticated ? 'No characters found' : 'Login with GTAW to see your characters'}
                    </option>
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
};

export default CharacterSelector;
