import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import useGtaWorldAuth from '../hooks/useGtaWorldAuth';

const CharacterSelector = ({ onCharacterSelect, selectedCharacterId, label = "Select Character", forceDropdown = false }) => {
    const { user: authUser } = useAuth();
    const { user: gtawUser, isAuthenticated: isGtawAuthenticated } = useGtaWorldAuth();
    const [user, setUser] = useState(null);
    const [characters, setCharacters] = useState([]);
    const [selectedCharacter, setSelectedCharacter] = useState(null);
    const [useSessionStorage, setUseSessionStorage] = useState(false);

    useEffect(() => {
        console.log('[CharacterSelector] User selection useEffect triggered:', {
            isGtawAuthenticated,
            hasGtawUser: !!gtawUser,
            hasAuthUser: !!authUser,
            hasAuthUserData: !!(authUser?.userData),
            useSessionStorage
        });
        
        // Check if sessionStorage data is available
        const fallbackUserRaw = sessionStorage.getItem('user');
        const hasSessionData = fallbackUserRaw && fallbackUserRaw !== 'null';
        
        if (hasSessionData && !useSessionStorage) {
            // Auto-enable sessionStorage if data is available and neither GTAW nor Firebase auth user is available
            if ((!authUser || !authUser.userData) && (!gtawUser || (!gtawUser.userData && !gtawUser.characters))) {
                setUseSessionStorage(true);
            }
        }
        
        // Set user data based on preference and availability
        // Priority: 1. GTAW user (most current) 2. Session storage (if enabled) 3. Firebase auth user
        if (isGtawAuthenticated && gtawUser) {
            console.log('[CharacterSelector] Setting user to GTAW user:', gtawUser);
            // GTAW user is always prioritized when authenticated, regardless of userData
            setUser(gtawUser);
        } else if (useSessionStorage && hasSessionData) {
            console.log('[CharacterSelector] Setting user to session storage data');
            try {
                const fallbackUser = JSON.parse(fallbackUserRaw);
                setUser({ userData: fallbackUser });
            } catch (e) {
                console.log('[CharacterSelector] Failed to parse session storage data, setting user to null');
                setUser(null);
            }
        } else if (authUser && authUser.userData) {
            console.log('[CharacterSelector] Setting user to Firebase auth user:', authUser);
            setUser(authUser);
        } else {
            console.log('[CharacterSelector] No valid user found, setting user to null');
            setUser(null);
        }
    }, [authUser, gtawUser, isGtawAuthenticated, useSessionStorage]);

    useEffect(() => {
        console.log('[CharacterSelector] useEffect triggered with dependencies:', {
            hasUser: !!user,
            selectedCharacterId,
            hasGtawUser: !!gtawUser,
            isGtawAuthenticated,
            userEqualsGtawUser: user === gtawUser
        });
        
        console.log('[CharacterSelector] Processing user data:', {
            hasUser: !!user,
            hasUserData: !!(user?.userData),
            isGtawUser: user === gtawUser,
            userDataSource: user === gtawUser ? 'GTAW' : (useSessionStorage ? 'Session' : 'Firebase'),
            characterFieldExists: !!(user?.userData?.character),
            charactersFieldExists: !!(user?.userData?.characters),
            hasGtawDirectCharacters: !!(gtawUser?.characters),
            hasUserCharacters: !!(user?.characters)
        });
        
        // Handle GTAW user data - check both direct characters and userData
        if (isGtawAuthenticated && gtawUser && (gtawUser.characters || gtawUser.character)) {
            console.log('[CharacterSelector] CONDITION MET: Processing GTAW user directly:', {
                hasCharacters: !!(gtawUser.characters || gtawUser.character),
                charactersLength: (gtawUser.characters || gtawUser.character)?.length || 0,
                characters: gtawUser.characters || gtawUser.character,
                hasUserData: !!(gtawUser.userData),
                userDataCharacters: gtawUser.userData?.character || gtawUser.userData?.characters,
                gtawUserKeys: Object.keys(gtawUser),
                gtawUserStructure: gtawUser
            });
            
            // Search for characters in all possible locations
            let characterArray = [];
            let characterSource = 'none';
            
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
            
            console.log('[CharacterSelector] Searching for characters in all possible locations:', 
                possibleCharacterPaths.map(p => ({ 
                    path: p.path, 
                    exists: !!p.value, 
                    isArray: Array.isArray(p.value),
                    length: p.value?.length || 0,
                    value: p.value
                }))
            );
            
            // Find the first valid character array
            for (const pathData of possibleCharacterPaths) {
                if (Array.isArray(pathData.value) && pathData.value.length > 0) {
                    characterArray = pathData.value;
                    characterSource = pathData.path;
                    break;
                }
            }
            
            console.log('[CharacterSelector] Character search results:', {
                foundCharacters: characterArray.length > 0,
                characterSource,
                isArray: Array.isArray(characterArray),
                length: characterArray?.length || 0,
                firstCharacter: characterArray?.[0]
            });
            
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
                
                console.log('[CharacterSelector] Filtered characters:', {
                    originalCount: characterArray.length,
                    filteredCount: filteredCharacters.length,
                    filteredCharacters: filteredCharacters.map(char => ({
                        id: char.id,
                        name: char.name || `${char.firstname || ''} ${char.lastname || ''}`.trim(),
                        format: char.name ? 'new' : 'old'
                    }))
                });
                
                if (filteredCharacters.length === 0) {
                    console.warn('[CharacterSelector] No valid characters found after filtering:', characterArray);
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
                console.log('[CharacterSelector] No GTAW character array found or empty array');
                setCharacters([]);
                return; // Exit early, don't try fallback for GTAW users
            }
        } 
        
        // Fallback to session storage or Firebase auth user (only if not GTAW authenticated)
        if (!isGtawAuthenticated && user && user.userData) {
            // Fallback to session storage or Firebase auth user (only if not GTAW authenticated)
            console.log('[CharacterSelector] Processing fallback user data');
            const characterArray = user.userData.character || user.userData.characters || [];
            
            console.log('[CharacterSelector] Fallback character array found:', {
                isArray: Array.isArray(characterArray),
                length: characterArray?.length || 0,
                firstCharacter: characterArray?.[0],
                arrayType: user.userData.character ? 'character' : (user.userData.characters ? 'characters' : 'none')
            });
            
            if (Array.isArray(characterArray) && characterArray.length > 0) {
                // Filter out null/undefined/invalid entries - old format
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
                console.log('[CharacterSelector] No fallback character array found or empty array');
                setCharacters([]);
            }
        } else if (!isGtawAuthenticated) {
            console.log('[CharacterSelector] No user or user data available for fallback');
            setCharacters([]);
        } else {
            console.log('[CharacterSelector] GTAW authenticated but condition not met:', {
                isGtawAuthenticated,
                hasGtawUser: !!gtawUser,
                userEqualsGtawUser: user === gtawUser,
                currentUser: user,
                gtawUser: gtawUser
            });
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

    const sessionUserRaw = sessionStorage.getItem('user');
    const hasSessionData = sessionUserRaw && sessionUserRaw !== 'null';
    
    const handleSessionToggle = () => {
        if (!useSessionStorage && hasSessionData) {
            setUseSessionStorage(true);
        } else {
            setUseSessionStorage(false);
        }
    };

    // Show debug info for troubleshooting
    const debugInfo = {
        isGtawAuthenticated,
        hasGtawUser: !!gtawUser,
        hasGtawUserData: !!(gtawUser?.userData),
        hasAuthUser: !!authUser,
        hasAuthUserData: !!(authUser?.userData),
        hasSessionData,
        useSessionStorage,
        charactersCount: characters.length,
        selectedCharacterId,
        selectedCharacterName: selectedCharacter?.fullName
    };
    
    console.log('[CharacterSelector] Current state:', debugInfo);

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