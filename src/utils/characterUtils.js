// Helper function to get character data from GTA World OAuth user
export const getCharacterData = (gtaWorldUser) => {
    if (!gtaWorldUser) return null;

    // Try to get character data from the proper location
    const characterArray = gtaWorldUser?.userData?.character || gtaWorldUser?.userData?.characters || gtaWorldUser?.character || gtaWorldUser?.characters || [];
    
    if (Array.isArray(characterArray) && characterArray.length > 0) {
        const character = characterArray[0]; // Use first character
        return {
            id: character.id, // This should be the character ID (5573 for Alyson Frost)
            firstname: character.firstname || '',
            lastname: character.lastname || '',
            fullName: `${character.firstname || ''} ${character.lastname || ''}`.trim(),
            memberid: character.memberid // This is the member ID (43132)
        };
    }

    // Try faction data with character info
    if (gtaWorldUser.faction && gtaWorldUser.factionData) {
        return {
            id: gtaWorldUser.factionData.characterId || gtaWorldUser.faction.characterId, // Use character ID from factionData
            firstname: gtaWorldUser.faction.firstname || '',
            lastname: gtaWorldUser.faction.lastname || '',
            fullName: `${gtaWorldUser.faction.firstname || ''} ${gtaWorldUser.faction.lastname || ''}`.trim() || gtaWorldUser.faction.characterName || gtaWorldUser.username,
            memberid: gtaWorldUser.id
        };
    }

    // Fallback to faction data if available (legacy support)
    if (gtaWorldUser.faction) {
        return {
            id: gtaWorldUser.faction.characterId || gtaWorldUser.id, // Prefer character ID over member ID
            firstname: gtaWorldUser.faction.firstname || '',
            lastname: gtaWorldUser.faction.lastname || '',
            fullName: `${gtaWorldUser.faction.firstname || ''} ${gtaWorldUser.faction.lastname || ''}`.trim() || gtaWorldUser.faction.characterName || gtaWorldUser.username,
            memberid: gtaWorldUser.id
        };
    }

    // Final fallback
    return {
        id: gtaWorldUser.id,
        firstname: '',
        lastname: '',
        fullName: gtaWorldUser.username || 'GTAW User',
        memberid: gtaWorldUser.id
    };
};

// Helper function to get character name with proper fallbacks
export const getCharacterName = (gtaWorldUser) => {
    const characterData = getCharacterData(gtaWorldUser);
    return characterData ? characterData.fullName : 'GTAW User';
};

// Helper function to get character ID (for badge numbers)
export const getCharacterID = (gtaWorldUser) => {
    const characterData = getCharacterData(gtaWorldUser);
    return characterData ? characterData.id : gtaWorldUser?.id;
};